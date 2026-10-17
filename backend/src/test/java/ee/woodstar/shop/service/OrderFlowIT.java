package ee.woodstar.shop.service;

import ee.woodstar.shop.PostgresTestSupport;
import ee.woodstar.shop.domain.*;
import ee.woodstar.shop.repository.*;
import ee.woodstar.shop.web.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Import(PostgresTestSupport.class)
class OrderFlowIT {

    @Autowired OrderService orderService;
    @Autowired ee.woodstar.shop.web.PublicController publicController;
    @Autowired PickupService pickupService;
    @Autowired InventoryService inventoryService;
    @Autowired SiteRepository sites;
    @Autowired ProductRepository products;
    @Autowired LockerRepository lockers;
    @Autowired OrderRepository orders;
    @Autowired LockerEventRepository events;

    Site site;
    Product product;
    Locker l1, l2;

    @BeforeEach
    void seed() {
        events.deleteAll();
        orders.deleteAll();
        lockers.deleteAll();
        products.deleteAll();
        sites.deleteAll();
        Instant now = Instant.now();
        site = sites.save(Site.builder().id(UUID.randomUUID()).name("Test site").address("Somewhere 1").active(true).createdAt(now).build());
        product = products.save(Product.builder().id(UUID.randomUUID()).nameEt("Kask").nameEn("Birch").priceCents(1200)
            .active(true).sortOrder(1).createdAt(now).build());
        l1 = lockers.save(locker("A1", now.minus(Duration.ofHours(2))));
        l2 = lockers.save(locker("A2", now.minus(Duration.ofHours(1))));
    }

    private Locker locker(String label, Instant stockedAt) {
        return Locker.builder().id(UUID.randomUUID()).site(site).label(label).shellyDeviceId("dev-" + label)
            .relayChannel(0).pulseSeconds(2).state(LockerState.STOCKED).product(product).stockedAt(stockedAt)
            .updatedAt(Instant.now()).build();
    }

    @Test
    void fullHappyPath_reserve_pay_open_reopen() {
        OrderService.Checkout c = orderService.create(site.getId(), product.getId(), "buyer@example.com", "+37255555555", "et", "127.0.0.1");
        assertThat(c.checkoutUrl()).contains("/api/dev/pay/" + c.orderId());

        Order o = orders.findById(c.orderId()).orElseThrow();
        assertThat(o.getState()).isEqualTo(OrderState.PENDING_PAYMENT);
        assertThat(o.getOrderNumber()).matches("WS-\\d{4}-\\d{6}");
        assertThat(o.getPickupToken()).hasSize(32);
        // FIFO: the older-stocked locker A1 is allocated first
        assertThat(lockers.findById(l1.getId()).orElseThrow().getState()).isEqualTo(LockerState.RESERVED);
        assertThat(lockers.findById(l2.getId()).orElseThrow().getState()).isEqualTo(LockerState.STOCKED);

        orderService.markPaid(c.orderId(), "ref-1");
        orderService.markPaid(c.orderId(), "ref-dup"); // idempotent
        o = orders.findById(c.orderId()).orElseThrow();
        assertThat(o.getState()).isEqualTo(OrderState.PAID);
        assertThat(o.getPaymentRef()).isEqualTo("ref-1");
        assertThat(o.getPickupDeadline()).isAfter(Instant.now().plus(Duration.ofHours(47)));
        assertThat(lockers.findById(l1.getId()).orElseThrow().getState()).isEqualTo(LockerState.SOLD);

        String token = o.getPickupToken();
        pickupService.open(token);
        o = orders.findById(c.orderId()).orElseThrow();
        assertThat(o.getState()).isEqualTo(OrderState.PICKED_UP);
        assertThat(o.getOpenCount()).isEqualTo(1);
        assertThat(o.getFirstOpenAt()).isNotNull();
        Locker after = lockers.findById(l1.getId()).orElseThrow();
        assertThat(after.getState()).isEqualTo(LockerState.EMPTY);
        assertThat(after.getProduct()).isNull();

        // second open within the reopen window is allowed
        pickupService.open(token);
        assertThat(orders.findById(c.orderId()).orElseThrow().getOpenCount()).isEqualTo(2);
        assertThat(pickupService.opensRemaining(orders.findById(c.orderId()).orElseThrow())).isEqualTo(3);

        assertThat(events.findByOrderIdOrderByCreatedAtAsc(c.orderId()))
            .extracting(LockerEvent::getType)
            .contains(LockerEventType.OPEN_REQUESTED, LockerEventType.OPEN_CONFIRMED, LockerEventType.EMPTIED);
    }

    @Test
    void orderWithoutEmail_isPaidAndOpened_butCannotBeEmailed() {
        OrderService.Checkout c = orderService.create(site.getId(), product.getId(), "  ", null, "et", "127.0.0.1");
        assertThat(orders.findById(c.orderId()).orElseThrow().getEmail()).isNull();
        orderService.markPaid(c.orderId(), "ref-no-email");
        Order o = orders.findById(c.orderId()).orElseThrow();
        assertThat(o.getState()).isEqualTo(OrderState.PAID);
        var view = publicController.order(c.orderId());
        assertThat(view.hasEmail()).isFalse();
        assertThat(view.pickupToken()).isEqualTo(o.getPickupToken());
        assertThatThrownBy(() -> orderService.resendEmail(c.orderId()))
            .isInstanceOf(ApiException.class).hasMessageContaining("no email");
        pickupService.open(o.getPickupToken());
        assertThat(orders.findById(c.orderId()).orElseThrow().getState()).isEqualTo(OrderState.PICKED_UP);
    }

    @Test
    void openBeforePayment_isRejected() {
        OrderService.Checkout c = orderService.create(site.getId(), product.getId(), "buyer@example.com", null, "en", "127.0.0.1");
        String token = orders.findById(c.orderId()).orElseThrow().getPickupToken();
        assertThatThrownBy(() -> pickupService.open(token))
            .isInstanceOf(ApiException.class)
            .extracting("code").isEqualTo("NOT_PAID");
    }

    @Test
    void soldOut_whenNoStockedLocker() {
        orderService.create(site.getId(), product.getId(), "a@example.com", null, "et", "127.0.0.1");
        orderService.create(site.getId(), product.getId(), "b@example.com", null, "et", "127.0.0.1");
        assertThatThrownBy(() -> orderService.create(site.getId(), product.getId(), "c@example.com", null, "et", "127.0.0.1"))
            .isInstanceOf(ApiException.class)
            .extracting("code").isEqualTo("SOLD_OUT");
    }

    @Test
    void offlineDevice_failsOpenAndKeepsOrderPaid() {
        Locker l = lockers.findById(l1.getId()).orElseThrow();
        l.setShellyDeviceId("shelly-offline-1");
        lockers.save(l);
        OrderService.Checkout c = orderService.create(site.getId(), product.getId(), "buyer@example.com", null, "et", "127.0.0.1");
        orderService.markPaid(c.orderId(), "ref");
        String token = orders.findById(c.orderId()).orElseThrow().getPickupToken();
        assertThatThrownBy(() -> pickupService.open(token))
            .isInstanceOf(ApiException.class)
            .extracting("code").isEqualTo("DEVICE_UNREACHABLE");
        assertThat(orders.findById(c.orderId()).orElseThrow().getState()).isEqualTo(OrderState.PAID);
        assertThat(lockers.findById(l1.getId()).orElseThrow().getState()).isEqualTo(LockerState.SOLD);
    }

    @Test
    void staleReservation_isExpiredAndLockerReleased() {
        OrderService.Checkout c = orderService.create(site.getId(), product.getId(), "buyer@example.com", null, "et", "127.0.0.1");
        Order o = orders.findById(c.orderId()).orElseThrow();
        o.setCreatedAt(Instant.now().minus(Duration.ofMinutes(20)));
        orders.save(o);

        int n = orderService.expireStaleReservations();
        assertThat(n).isEqualTo(1);
        assertThat(orders.findById(c.orderId()).orElseThrow().getState()).isEqualTo(OrderState.EXPIRED);
        assertThat(lockers.findById(l1.getId()).orElseThrow().getState()).isEqualTo(LockerState.STOCKED);

        // fresh reservation is left alone
        OrderService.Checkout c2 = orderService.create(site.getId(), product.getId(), "x@example.com", null, "et", "127.0.0.1");
        assertThat(orderService.expireStaleReservations()).isZero();
        assertThat(orders.findById(c2.orderId()).orElseThrow().getState()).isEqualTo(OrderState.PENDING_PAYMENT);
    }

    @Test
    void cancelPendingOrder_releasesLocker() {
        OrderService.Checkout c = orderService.create(site.getId(), product.getId(), "buyer@example.com", null, "et", "127.0.0.1");
        orderService.cancel(c.orderId(), "admin");
        assertThat(orders.findById(c.orderId()).orElseThrow().getState()).isEqualTo(OrderState.CANCELLED);
        assertThat(lockers.findById(l1.getId()).orElseThrow().getState()).isEqualTo(LockerState.STOCKED);
    }

    @Test
    void adminSearch_withoutFilters_listsOrders_andMatchesQuery() {
        OrderService.Checkout c = orderService.create(site.getId(), product.getId(), "buyer@example.com", null, "et", "127.0.0.1");
        var page = org.springframework.data.domain.PageRequest.of(0, 50);
        assertThat(orders.search(null, null, "", page)).extracting(Order::getId).containsExactly(c.orderId());
        assertThat(orders.search(null, site.getId(), "BUYER@", page)).hasSize(1);
        assertThat(orders.search(OrderState.PAID, null, "", page)).isEmpty();
        assertThat(orders.search(null, null, "nobody", page)).isEmpty();
    }

    @Test
    void soldLocker_markedEmptied_completesOrder_andLinkCannotOpen() {
        OrderService.Checkout c = orderService.create(site.getId(), product.getId(), "buyer@example.com", null, "et", "127.0.0.1");
        orderService.markPaid(c.orderId(), "ref-1");
        assertThat(lockers.findById(l1.getId()).orElseThrow().getState()).isEqualTo(LockerState.SOLD);

        inventoryService.empty(l1.getId(), "admin");

        Locker l = lockers.findById(l1.getId()).orElseThrow();
        assertThat(l.getState()).isEqualTo(LockerState.EMPTY);
        assertThat(l.getProduct()).isNull();
        Order o = orders.findById(c.orderId()).orElseThrow();
        assertThat(o.getState()).isEqualTo(OrderState.PICKED_UP);
        assertThat(o.getPickedUpAt()).isNotNull();
        assertThat(pickupService.cannotOpenReason(o)).contains("REOPEN_WINDOW_CLOSED");
    }

    @Test
    void soldLocker_stockedAgain_expiresOrder_andGoesBackOnSale() {
        OrderService.Checkout c = orderService.create(site.getId(), product.getId(), "buyer@example.com", null, "et", "127.0.0.1");
        orderService.markPaid(c.orderId(), "ref-1");

        inventoryService.stock(l1.getId(), product.getId(), "admin");

        Locker l = lockers.findById(l1.getId()).orElseThrow();
        assertThat(l.getState()).isEqualTo(LockerState.STOCKED);
        assertThat(l.getProduct().getId()).isEqualTo(product.getId());
        Order o = orders.findById(c.orderId()).orElseThrow();
        assertThat(o.getState()).isEqualTo(OrderState.EXPIRED);
        assertThat(pickupService.cannotOpenReason(o)).contains("EXPIRED");
    }

    @Test
    void reservedLocker_cannotBeEmptiedOrStocked() {
        orderService.create(site.getId(), product.getId(), "buyer@example.com", null, "et", "127.0.0.1");
        assertThatThrownBy(() -> inventoryService.empty(l1.getId(), "admin")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> inventoryService.stock(l1.getId(), product.getId(), "admin")).isInstanceOf(ApiException.class);
    }
}
