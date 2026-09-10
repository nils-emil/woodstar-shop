package ee.woodstar.shop.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.domain.Order;
import ee.woodstar.shop.payment.MaksekeskusPaymentGateway;
import ee.woodstar.shop.repository.OrderRepository;
import ee.woodstar.shop.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Maksekeskus posts form fields {@code json} (the notification payload) and {@code mac}
 * (SHA-512 of json + secret key) to the transaction's notification_url. Only a COMPLETED
 * status with a matching amount marks the order paid; the browser returning to the
 * success page never does, since anyone can open that URL.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class MaksekeskusWebhookController {

    private final WoodstarProperties props;
    private final OrderService orderService;
    private final OrderRepository orders;
    private final ObjectMapper mapper = new ObjectMapper();

    @PostMapping("/api/webhooks/maksekeskus")
    public ResponseEntity<String> handle(@RequestParam(value = "json", required = false) String json,
                                         @RequestParam(value = "mac", required = false) String mac) {
        String secret = props.getPayments().getMaksekeskus().getSecretKey();
        if (secret == null || secret.isBlank()) {
            log.error("Maksekeskus notification received but MAKSEKESKUS_SECRET_KEY is not configured");
            return ResponseEntity.status(500).body("secret not configured");
        }
        if (!MaksekeskusPaymentGateway.macMatches(json, mac, secret)) {
            log.warn("Maksekeskus notification with invalid MAC");
            return ResponseEntity.badRequest().body("invalid signature");
        }

        JsonNode node;
        try {
            node = mapper.readTree(json);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("invalid payload");
        }
        String transactionId = node.path("transaction").asText(null);
        String status = node.path("status").asText(null);
        String merchantData = node.path("merchant_data").asText(null);
        String amount = node.path("amount").asText(null);
        if (transactionId == null || status == null || merchantData == null) {
            return ResponseEntity.badRequest().body("missing fields");
        }

        UUID orderId;
        try {
            orderId = UUID.fromString(merchantData);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("bad merchant_data");
        }
        log.info("Maksekeskus notification: transaction {} status {} for order {}", transactionId, status, orderId);

        if (!"COMPLETED".equalsIgnoreCase(status)) {
            // CANCELLED / EXPIRED / PENDING: the reservation-expiry job releases the locker.
            return ResponseEntity.ok("ignored");
        }
        Order order = orders.findById(orderId).orElse(null);
        if (order == null) {
            log.warn("Maksekeskus notification for unknown order {}", orderId);
            return ResponseEntity.ok("unknown order");
        }
        String expected = MaksekeskusPaymentGateway.formatAmount(order.getPriceCents());
        if (amount != null && !amountsEqual(amount, expected)) {
            log.error("Maksekeskus amount {} does not match order {} price {}", amount, order.getOrderNumber(), expected);
            return ResponseEntity.badRequest().body("amount mismatch");
        }
        orderService.markPaid(orderId, transactionId);
        return ResponseEntity.ok("ok");
    }

    private static boolean amountsEqual(String a, String b) {
        try {
            return new java.math.BigDecimal(a).compareTo(new java.math.BigDecimal(b)) == 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }
}
