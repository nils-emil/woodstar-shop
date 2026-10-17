package ee.woodstar.shop.payment;

import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.domain.Order;
import ee.woodstar.shop.domain.OrderState;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MaksekeskusPaymentGatewayTest {

    private static Order order() {
        return Order.builder().id(UUID.fromString("11111111-2222-3333-4444-555555555555")).orderNumber("WS-2026-000042")
            .productName("Kask").priceCents(1250).email("buyer@example.com").locale("et")
            .state(OrderState.PENDING_PAYMENT).pickupToken("tok").paymentProvider("maksekeskus")
            .createdAt(Instant.now()).openCount(0).build();
    }

    private static MaksekeskusPaymentGateway gateway() {
        WoodstarProperties props = new WoodstarProperties();
        props.getPayments().getMaksekeskus().setShopId("shop");
        props.getPayments().getMaksekeskus().setSecretKey("secret");
        return new MaksekeskusPaymentGateway(props);
    }

    @Test
    void formatsAmountWithTwoDecimals() {
        assertThat(MaksekeskusPaymentGateway.formatAmount(1250)).isEqualTo("12.50");
        assertThat(MaksekeskusPaymentGateway.formatAmount(900)).isEqualTo("9.00");
        assertThat(MaksekeskusPaymentGateway.formatAmount(5)).isEqualTo("0.05");
    }

    @Test
    @SuppressWarnings("unchecked")
    void transactionBody_carriesAmountReferenceUrlsAndCustomer() {
        Map<String, Object> body = MaksekeskusPaymentGateway.buildTransactionBody(order(),
            "https://shop/order/x", "https://shop/?cancelled=1", "https://shop/api/webhooks/maksekeskus", "1.2.3.4");
        Map<String, Object> tx = (Map<String, Object>) body.get("transaction");
        assertThat(tx).containsEntry("amount", "12.50").containsEntry("currency", "EUR")
            .containsEntry("reference", "WS-2026-000042")
            .containsEntry("merchant_data", "11111111-2222-3333-4444-555555555555");
        Map<String, Object> urls = (Map<String, Object>) tx.get("transaction_url");
        assertThat((Map<String, Object>) urls.get("notification_url"))
            .containsEntry("url", "https://shop/api/webhooks/maksekeskus").containsEntry("method", "POST");
        assertThat((Map<String, Object>) urls.get("return_url")).containsEntry("method", "GET");
        Map<String, Object> customer = (Map<String, Object>) body.get("customer");
        assertThat(customer).containsEntry("ip", "1.2.3.4").containsEntry("email", "buyer@example.com")
            .containsEntry("country", "ee").containsEntry("locale", "et");
    }

    @Test
    void transactionBody_leavesOutEmailWhenBuyerGaveNone() {
        Order o = order();
        o.setEmail(null);
        Map<?, ?> customer = (Map<?, ?>) MaksekeskusPaymentGateway.buildTransactionBody(o, "a", "b", "c", "1.2.3.4").get("customer");
        assertThat(customer.containsKey("email")).isFalse();
        assertThat(customer.get("ip")).isEqualTo("1.2.3.4");
    }

    @Test
    void transactionBody_fallsBackToLoopbackWhenIpUnknown() {
        Map<String, Object> body = MaksekeskusPaymentGateway.buildTransactionBody(order(), "a", "b", "c", null);
        assertThat(((Map<?, ?>) body.get("customer")).get("ip")).isEqualTo("127.0.0.1");
    }

    @Test
    void parsesTransactionIdAndHostedPaymentPageUrl() {
        String response = "{\"id\":\"abc-123\",\"status\":\"CREATED\",\"payment_methods\":{"
            + "\"banklinks\":[{\"name\":\"swedbank\",\"url\":\"https://bank/1\"}],"
            + "\"other\":[{\"name\":\"redirect\",\"url\":\"https://payment.maksekeskus.ee/pay/1/link.html?trx=abc-123\"}]}}";
        MaksekeskusPaymentGateway.Checkout c = gateway().parseTransactionResponse(response);
        assertThat(c.transactionId()).isEqualTo("abc-123");
        assertThat(c.redirectUrl()).isEqualTo("https://payment.maksekeskus.ee/pay/1/link.html?trx=abc-123");
    }

    @Test
    void responseWithoutRedirect_fails() {
        assertThatThrownBy(() -> gateway().parseTransactionResponse("{\"id\":\"abc\",\"payment_methods\":{\"banklinks\":[]}}"))
            .isInstanceOf(PaymentException.class);
    }

    @Test
    void mac_isUppercaseSha512OfJsonPlusSecret_andComparisonIsCaseInsensitive() {
        String json = "{\"transaction\":\"t\",\"status\":\"COMPLETED\"}";
        String mac = MaksekeskusPaymentGateway.computeMac(json, "secret");
        assertThat(mac).hasSize(128).isEqualTo(mac.toUpperCase());
        assertThat(MaksekeskusPaymentGateway.macMatches(json, mac.toLowerCase(), "secret")).isTrue();
        assertThat(MaksekeskusPaymentGateway.macMatches(json, mac, "other")).isFalse();
        assertThat(MaksekeskusPaymentGateway.macMatches(json + " ", mac, "secret")).isFalse();
        assertThat(MaksekeskusPaymentGateway.macMatches(json, null, "secret")).isFalse();
        assertThat(MaksekeskusPaymentGateway.macMatches(json, mac, "")).isFalse();
    }

    @Test
    void missingCredentials_failFastAtStartup() {
        assertThatThrownBy(() -> new MaksekeskusPaymentGateway(new WoodstarProperties()))
            .isInstanceOf(IllegalStateException.class).hasMessageContaining("MAKSEKESKUS_SHOP_ID");
    }
}
