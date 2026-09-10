package ee.woodstar.shop.service;

import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.domain.*;
import ee.woodstar.shop.locker.LockerController;
import ee.woodstar.shop.repository.OrderRepository;
import ee.woodstar.shop.web.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PickupService {

    private final OrderRepository orders;
    private final LockerController lockerController;
    private final LockerEventService events;
    private final WoodstarProperties props;
    private final Clock clock;

    /** Why an order cannot be opened right now, or empty if it can. */
    public Optional<String> cannotOpenReason(Order order) {
        Instant now = clock.instant();
        return switch (order.getState()) {
            case PENDING_PAYMENT -> Optional.of("NOT_PAID");
            case EXPIRED, CANCELLED, REFUNDED -> Optional.of("EXPIRED");
            case PAID -> Optional.empty();
            case PICKED_UP -> {
                if (order.getOpenCount() >= props.getPickup().getMaxOpens()) yield Optional.of("TOO_MANY_OPENS");
                Instant windowEnd = order.getFirstOpenAt().plus(Duration.ofMinutes(props.getPickup().getReopenWindowMinutes()));
                yield now.isBefore(windowEnd) ? Optional.empty() : Optional.of("REOPEN_WINDOW_CLOSED");
            }
        };
    }

    public int opensRemaining(Order order) {
        return Math.max(0, props.getPickup().getMaxOpens() - order.getOpenCount());
    }

    @Transactional(readOnly = true)
    public Order findByToken(String token) {
        return orders.findByPickupToken(token).orElseThrow(() -> ApiException.notFound("Order"));
    }

    @Transactional
    public Order open(String token) {
        Order order = findByToken(token);
        cannotOpenReason(order).ifPresent(reason -> {
            throw ApiException.conflict(reason, "Locker cannot be opened: " + reason);
        });
        Locker locker = order.getLocker();
        events.record(locker.getId(), order.getId(), LockerEventType.OPEN_REQUESTED, "customer");

        LockerController.OpenResult result = lockerController.open(
            locker.getShellyDeviceId(), locker.getRelayChannel(), locker.getPulseSeconds());

        if (!result.ok()) {
            events.record(locker.getId(), order.getId(), LockerEventType.OPEN_FAILED, result.detail());
            log.warn("Open failed for order {} locker {}: {}", order.getOrderNumber(), locker.getLabel(), result.detail());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "DEVICE_UNREACHABLE", result.detail());
        }

        Instant now = clock.instant();
        events.record(locker.getId(), order.getId(), LockerEventType.OPEN_CONFIRMED, result.detail());
        if (order.getState() == OrderState.PAID) {
            order.setState(OrderState.PICKED_UP);
            order.setPickedUpAt(now);
            order.setFirstOpenAt(now);
            locker.setState(LockerState.EMPTY);
            locker.setProduct(null);
            locker.setStockedAt(null);
            locker.setUpdatedAt(now);
            events.record(locker.getId(), order.getId(), LockerEventType.EMPTIED, "picked up by customer");
        }
        order.setOpenCount(order.getOpenCount() + 1);
        log.info("Locker {} opened for order {} (open #{})", locker.getLabel(), order.getOrderNumber(), order.getOpenCount());
        return order;
    }
}
