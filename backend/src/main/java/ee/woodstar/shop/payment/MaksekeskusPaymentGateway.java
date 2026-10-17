package ee.woodstar.shop.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.domain.Order;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Maksekeskus (MakeCommerce) gateway: creates a transaction over the REST API and sends the
 * customer to the hosted payment page, where they pick a bank link or card.
 * Notifications are verified in {@link ee.woodstar.shop.web.MaksekeskusWebhookController}.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "woodstar.payments", name = "provider", havingValue = "maksekeskus")
public class MaksekeskusPaymentGateway implements PaymentGateway {

    private final WoodstarProperties.Maksekeskus config;
    private final String publicBaseUrl;
    private final RestClient http;
    private final ObjectMapper json = new ObjectMapper();

    public MaksekeskusPaymentGateway(WoodstarProperties props) {
        this(props, RestClient.create());
    }

    MaksekeskusPaymentGateway(WoodstarProperties props, RestClient http) {
        this.config = props.getPayments().getMaksekeskus();
        this.publicBaseUrl = props.getPublicBaseUrl();
        this.http = http;
        if (isBlank(config.getShopId()) || isBlank(config.getSecretKey())) {
            throw new IllegalStateException(
                "MAKSEKESKUS_SHOP_ID and MAKSEKESKUS_SECRET_KEY are required when PAYMENTS_PROVIDER=maksekeskus");
        }
    }

    @Override
    public String createCheckout(Order order, String successUrl, String cancelUrl, String customerIp) {
        Map<String, Object> body = buildTransactionBody(order, successUrl, cancelUrl,
            publicBaseUrl + "/api/webhooks/maksekeskus", customerIp);
        String response;
        try {
            response = http.post()
                .uri(config.getBaseUrl() + "/transactions")
                .header("Authorization", basicAuth())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);
        } catch (RestClientResponseException e) {
            log.error("Maksekeskus rejected transaction for order {}: {} {}",
                order.getOrderNumber(), e.getStatusCode(), e.getResponseBodyAsString());
            throw new PaymentException("Maksekeskus transaction creation failed: " + e.getStatusCode(), e);
        } catch (Exception e) {
            throw new PaymentException("Maksekeskus unreachable: " + e.getMessage(), e);
        }
        Checkout checkout = parseTransactionResponse(response);
        order.setPaymentRef(checkout.transactionId());
        log.info("Maksekeskus transaction {} created for order {}", checkout.transactionId(), order.getOrderNumber());
        return checkout.redirectUrl();
    }

    @Override
    public void refund(Order order) {
        if (order.getPaymentRef() == null) {
            throw new PaymentException("Order has no Maksekeskus transaction to refund", null);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("transaction", order.getPaymentRef());
        body.put("amount", formatAmount(order.getPriceCents()));
        body.put("comment", "Puukapp order " + order.getOrderNumber() + " cancelled");
        try {
            http.post()
                .uri(config.getBaseUrl() + "/refunds")
                .header("Authorization", basicAuth())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
            log.info("Refunded order {} via Maksekeskus transaction {}", order.getOrderNumber(), order.getPaymentRef());
        } catch (RestClientResponseException e) {
            throw new PaymentException("Maksekeskus refund failed: " + e.getStatusCode() + " " + e.getResponseBodyAsString(), e);
        } catch (Exception e) {
            throw new PaymentException("Maksekeskus unreachable: " + e.getMessage(), e);
        }
    }

    @Override
    public String providerName() {
        return "maksekeskus";
    }

    // --- pure helpers, unit tested ---

    record Checkout(String transactionId, String redirectUrl) {}

    static Map<String, Object> buildTransactionBody(Order order, String returnUrl, String cancelUrl,
                                                    String notificationUrl, String customerIp) {
        Map<String, Object> urls = new LinkedHashMap<>();
        urls.put("return_url", Map.of("url", returnUrl, "method", "GET"));
        urls.put("cancel_url", Map.of("url", cancelUrl, "method", "GET"));
        urls.put("notification_url", Map.of("url", notificationUrl, "method", "POST"));

        Map<String, Object> transaction = new LinkedHashMap<>();
        transaction.put("amount", formatAmount(order.getPriceCents()));
        transaction.put("currency", "EUR");
        transaction.put("reference", order.getOrderNumber());
        // merchant_data comes back verbatim on the notification; it is how we find the order.
        transaction.put("merchant_data", order.getId().toString());
        transaction.put("transaction_url", urls);

        Map<String, Object> customer = new LinkedHashMap<>();
        customer.put("ip", isBlank(customerIp) ? "127.0.0.1" : customerIp);
        if (!isBlank(order.getEmail())) customer.put("email", order.getEmail());
        customer.put("country", "ee");
        customer.put("locale", order.getLocale());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("transaction", transaction);
        body.put("customer", customer);
        return body;
    }

    Checkout parseTransactionResponse(String response) {
        try {
            JsonNode root = json.readTree(response);
            String id = root.path("id").asText(null);
            String url = null;
            // The hosted payment page is the "other" method named "redirect".
            for (JsonNode container : new JsonNode[]{root.path("payment_methods").path("other"), root.path("other")}) {
                for (JsonNode m : container) {
                    if ("redirect".equals(m.path("name").asText())) {
                        url = m.path("url").asText(null);
                    }
                }
            }
            if (id == null || url == null) {
                throw new PaymentException("Maksekeskus response missing id or redirect url", null);
            }
            return new Checkout(id, url);
        } catch (PaymentException e) {
            throw e;
        } catch (Exception e) {
            throw new PaymentException("Cannot parse Maksekeskus response: " + e.getMessage(), e);
        }
    }

    public static String formatAmount(int cents) {
        return String.format(Locale.ROOT, "%d.%02d", cents / 100, cents % 100);
    }

    /** Notification MAC: upper-case hex SHA-512 of the raw json followed by the shop's secret key. */
    public static String computeMac(String rawJson, String secretKey) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-512")
                .digest((rawJson + secretKey).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02X", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-512 unavailable", e);
        }
    }

    public static boolean macMatches(String rawJson, String mac, String secretKey) {
        if (rawJson == null || mac == null || isBlank(secretKey)) return false;
        return MessageDigest.isEqual(
            computeMac(rawJson, secretKey).getBytes(StandardCharsets.UTF_8),
            mac.toUpperCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
    }

    private String basicAuth() {
        return "Basic " + Base64.getEncoder().encodeToString(
            (config.getShopId() + ":" + config.getSecretKey()).getBytes(StandardCharsets.UTF_8));
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
