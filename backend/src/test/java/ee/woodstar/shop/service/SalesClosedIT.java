package ee.woodstar.shop.service;

import ee.woodstar.shop.PostgresTestSupport;
import ee.woodstar.shop.domain.*;
import ee.woodstar.shop.repository.*;
import ee.woodstar.shop.web.ApiException;
import ee.woodstar.shop.web.PublicController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** No payment provider configured: the shop shows stock but refuses orders and reserves nothing. */
@SpringBootTest(properties = "woodstar.payments.provider=none")
@ActiveProfiles("test")
@Import(PostgresTestSupport.class)
class SalesClosedIT {

    @Autowired OrderService orderService;
    @Autowired PublicController publicController;
    @Autowired SiteRepository sites;
    @Autowired ProductRepository products;
    @Autowired LockerRepository lockers;
    @Autowired OrderRepository orders;
    @Autowired LockerEventRepository events;

    @Test
    void ordersAreRefused_andNoLockerIsReserved() {
        events.deleteAll();
        orders.deleteAll();
        lockers.deleteAll();
        products.deleteAll();
        sites.deleteAll();
        Instant now = Instant.now();
        Site site = sites.save(Site.builder().id(UUID.randomUUID()).name("S").address("A").active(true).createdAt(now).build());
        Product product = products.save(Product.builder().id(UUID.randomUUID()).nameEt("Kask").nameEn("Birch").priceCents(1200)
            .active(true).sortOrder(1).createdAt(now).build());
        Locker locker = lockers.save(Locker.builder().id(UUID.randomUUID()).site(site).label("A1").shellyDeviceId("dev-A1")
            .relayChannel(0).pulseSeconds(2).state(LockerState.STOCKED).product(product).stockedAt(now).updatedAt(now).build());

        assertThat(publicController.status().salesOpen()).isFalse();
        assertThatThrownBy(() -> orderService.create(site.getId(), product.getId(), "b@example.com", null, "et", "127.0.0.1"))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("not open");
        assertThat(lockers.findById(locker.getId()).orElseThrow().getState()).isEqualTo(LockerState.STOCKED);
        assertThat(orders.count()).isZero();
    }
}
