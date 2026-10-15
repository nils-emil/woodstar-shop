package ee.woodstar.shop.web;

import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

/** Stand-in for the payment provider's hosted page when woodstar.payments.provider=fake. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "woodstar.payments", name = "provider", havingValue = "fake")
public class DevPaymentController {

    private final OrderService orderService;
    private final WoodstarProperties props;

    @GetMapping("/api/dev/pay/{orderId}")
    public ResponseEntity<Void> pay(@PathVariable UUID orderId) {
        orderService.markPaid(orderId, "fake-" + orderId);
        return ResponseEntity.status(HttpStatus.FOUND)
            .location(URI.create(props.getPublicBaseUrl() + "/order/" + orderId))
            .build();
    }
}
