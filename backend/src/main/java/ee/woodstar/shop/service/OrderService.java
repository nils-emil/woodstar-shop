package ee.woodstar.shop.service;

import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.domain.*;
import ee.woodstar.shop.payment.PaymentGateway;
import ee.woodstar.shop.repository.*;
import ee.woodstar.shop.web.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orders;
    private final LockerRepository lockers;
    private final SiteRepository sites;
    private final ProductRepository products;
    private final PaymentGateway paymentGateway;
    private final MailService mailService;
    private final LockerEventService events;
    private final WoodstarProperties props;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public record Checkout(UUID orderId, String checkoutUrl) {}

    @Transactional
    public Checkout create(UUID siteId, UUID productId, String email, String phone, String locale, String customerIp) {
        Site site = sites.findById(siteId).filter(Site::isActive).orElseThrow(() -> ApiException.notFound("Site"));
        Product product = products.findById(productId).filter(Product::isActive).orElseThrow(() -> ApiException.notFound("Product"));
        Locker locker = lockers.lockOneStocked(siteId, productId)
            .orElseThrow(() -> ApiException.conflict("SOLD_OUT", "No stocked locker available for this product at this site"));

        Instant now = clock.instant();
        locker.setState(LockerState.RESERVED);
        locker.setUpdatedAt(now);

        String loc = "en".equalsIgnoreCase(locale) ? "en" : "et";
        Order order = Order.builder()
            .id(UUID.randomUUID())
            .orderNumber(nextOrderNumber(now))
            .site(site)
            .locker(locker)
            .product(product)
            .productName(product.nameFor(loc))
            .priceCents(product.getPriceCents())
            .email(email.trim())
            .phone(phone == null || phone.isBlank() ? null : phone.trim())
            .locale(loc)
            .state(OrderState.PENDING_PAYMENT)
            .pickupToken(newToken())
            .paymentProvider(paymentGateway.providerName())
            .createdAt(now)
            .openCount(0)
            .build();
        orders.save(order);
        events.record(locker.getId(), order.getId(), LockerEventType.STATE_CHANGED, "RESERVED by order " + order.getOrderNumber());

        String base = props.getPublicBaseUrl();
        String url = paymentGateway.createCheckout(order, base + "/order/" + order.getId(), base + "/?cancelled=1", customerIp);
        log.info("Order {} created for locker {} at {}", order.getOrderNumber(), locker.getLabel(), site.getName());
        return new Checkout(order.getId(), url);
    }

    /** Idempotent: a second call for an already-paid order is a no-op. */
    @Transactional
    public Order markPaid(UUID orderId, String paymentRef) {
        Order order = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order"));
        if (order.getState() != OrderState.PENDING_PAYMENT) {
            log.info("markPaid ignored for order {} in state {}", order.getOrderNumber(), order.getState());
            return order;
        }
        Instant now = clock.instant();
        order.setState(OrderState.PAID);
        order.setPaidAt(now);
        order.setPickupDeadline(now.plus(Duration.ofHours(props.getPickup().getDeadlineHours())));
        if (paymentRef != null) order.setPaymentRef(paymentRef);
        Locker locker = order.getLocker();
        locker.setState(LockerState.SOLD);
        locker.setUpdatedAt(now);
        events.record(locker.getId(), order.getId(), LockerEventType.STATE_CHANGED, "SOLD, order " + order.getOrderNumber() + " paid");
        mailService.sendPickupEmail(order);
        log.info("Order {} paid", order.getOrderNumber());
        return order;
    }

    @Transactional
    public Order cancel(UUID orderId, String actor) {
        Order order = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order"));
        Instant now = clock.instant();
        Locker locker = order.getLocker();
        switch (order.getState()) {
            case PENDING_PAYMENT -> {
                order.setState(OrderState.CANCELLED);
                releaseLocker(locker, order, now, "CANCELLED by " + actor);
            }
            case PAID -> {
                paymentGateway.refund(order);
                order.setState(OrderState.REFUNDED);
                releaseLocker(locker, order, now, "REFUNDED by " + actor);
            }
            default -> throw ApiException.conflict("INVALID_STATE", "Order in state " + order.getState() + " cannot be cancelled");
        }
        return order;
    }

    /** Releases lockers held by unpaid orders older than the reservation TTL. */
    @Transactional
    public int expireStaleReservations() {
        Instant cutoff = clock.instant().minus(Duration.ofMinutes(props.getOrder().getReservationTtlMinutes()));
        List<Order> stale = orders.findByStateAndCreatedAtBefore(OrderState.PENDING_PAYMENT, cutoff);
        Instant now = clock.instant();
        for (Order o : stale) {
            o.setState(OrderState.EXPIRED);
            releaseLocker(o.getLocker(), o, now, "reservation expired");
            log.info("Order {} expired, locker {} released", o.getOrderNumber(), o.getLocker().getLabel());
        }
        return stale.size();
    }

    private void releaseLocker(Locker locker, Order order, Instant now, String detail) {
        if (locker.getState() == LockerState.RESERVED || locker.getState() == LockerState.SOLD) {
            locker.setState(LockerState.STOCKED);
            locker.setUpdatedAt(now);
            events.record(locker.getId(), order.getId(), LockerEventType.STATE_CHANGED, "STOCKED again: " + detail);
        }
    }

    @Transactional
    public void resendEmail(UUID orderId) {
        Order order = orders.findById(orderId).orElseThrow(() -> ApiException.notFound("Order"));
        if (order.getState() != OrderState.PAID && order.getState() != OrderState.PICKED_UP) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE", "Order is not paid");
        }
        mailService.sendPickupEmail(order);
    }

    private String nextOrderNumber(Instant now) {
        long seq = orders.nextOrderNumber();
        int year = now.atZone(ZoneOffset.UTC).getYear();
        return String.format("WS-%d-%06d", year, seq);
    }

    private String newToken() {
        byte[] bytes = new byte[24];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
