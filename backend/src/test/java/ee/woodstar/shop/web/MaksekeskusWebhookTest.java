package ee.woodstar.shop.web;

import ee.woodstar.shop.PostgresTestSupport;
import ee.woodstar.shop.domain.*;
import ee.woodstar.shop.payment.MaksekeskusPaymentGateway;
import ee.woodstar.shop.repository.*;
import ee.woodstar.shop.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Notification handling uses the test profile's secret key "test-secret". */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(PostgresTestSupport.class)
class MaksekeskusWebhookTest {

    static final String SECRET = "test-secret";

    @Autowired MockMvc mvc;
    @Autowired OrderService orderService;
    @Autowired SiteRepository sites;
    @Autowired ProductRepository products;
    @Autowired LockerRepository lockers;
    @Autowired OrderRepository orders;
    @Autowired LockerEventRepository events;

    Site site;
    Product product;

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
        lockers.save(Locker.builder().id(UUID.randomUUID()).site(site).label("A1").shellyDeviceId("dev-A1")
            .relayChannel(0).pulseSeconds(2).state(LockerState.STOCKED).product(product).stockedAt(now).updatedAt(now).build());
    }

    private UUID pendingOrder() {
        return orderService.create(site.getId(), product.getId(), "buyer@example.com", null, "et", "127.0.0.1").orderId();
    }

    private static String notification(UUID orderId, String status, String amount) {
        return "{\"shop\":\"test-shop\",\"transaction\":\"mk-tx-1\",\"amount\":\"" + amount
            + "\",\"currency\":\"EUR\",\"status\":\"" + status + "\",\"merchant_data\":\"" + orderId + "\"}";
    }

    @Test
    void invalidMac_returns400_andOrderStaysPending() throws Exception {
        UUID orderId = pendingOrder();
        String json = notification(orderId, "COMPLETED", "12.00");
        mvc.perform(post("/api/webhooks/maksekeskus").contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("json", json).param("mac", "DEADBEEF"))
            .andExpect(status().isBadRequest());
        assertThat(orders.findById(orderId).orElseThrow().getState()).isEqualTo(OrderState.PENDING_PAYMENT);
    }

    @Test
    void missingParams_returns400() throws Exception {
        mvc.perform(post("/api/webhooks/maksekeskus").contentType(MediaType.APPLICATION_FORM_URLENCODED))
            .andExpect(status().isBadRequest());
    }

    @Test
    void completedWithValidMac_marksOrderPaid_andIsIdempotent() throws Exception {
        UUID orderId = pendingOrder();
        String json = notification(orderId, "COMPLETED", "12.00");
        String mac = MaksekeskusPaymentGateway.computeMac(json, SECRET);
        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/api/webhooks/maksekeskus").contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .param("json", json).param("mac", mac.toLowerCase()))
                .andExpect(status().isOk());
        }
        Order order = orders.findById(orderId).orElseThrow();
        assertThat(order.getState()).isEqualTo(OrderState.PAID);
        assertThat(order.getPaymentRef()).isEqualTo("mk-tx-1");
        assertThat(lockers.findById(order.getLocker().getId()).orElseThrow().getState()).isEqualTo(LockerState.SOLD);
    }

    @Test
    void amountMismatch_returns400_andOrderStaysPending() throws Exception {
        UUID orderId = pendingOrder();
        String json = notification(orderId, "COMPLETED", "1.00");
        mvc.perform(post("/api/webhooks/maksekeskus").contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("json", json).param("mac", MaksekeskusPaymentGateway.computeMac(json, SECRET)))
            .andExpect(status().isBadRequest());
        assertThat(orders.findById(orderId).orElseThrow().getState()).isEqualTo(OrderState.PENDING_PAYMENT);
    }

    @Test
    void cancelledStatus_isIgnored() throws Exception {
        UUID orderId = pendingOrder();
        String json = notification(orderId, "CANCELLED", "12.00");
        mvc.perform(post("/api/webhooks/maksekeskus").contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("json", json).param("mac", MaksekeskusPaymentGateway.computeMac(json, SECRET)))
            .andExpect(status().isOk());
        assertThat(orders.findById(orderId).orElseThrow().getState()).isEqualTo(OrderState.PENDING_PAYMENT);
    }

    @Test
    void adminEndpoint_withoutLogin_returns401Json() throws Exception {
        mvc.perform(get("/api/admin/dashboard"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
    }

    @Test
    void adminLogin_withSeededCredentials_works() throws Exception {
        mvc.perform(post("/api/admin/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"admin\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.username").value("admin"));
        mvc.perform(post("/api/admin/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"nope\"}"))
            .andExpect(status().isUnauthorized());
    }
}
