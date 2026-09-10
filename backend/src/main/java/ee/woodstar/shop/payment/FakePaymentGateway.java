package ee.woodstar.shop.payment;

import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.domain.Order;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "woodstar.payments", name = "provider", havingValue = "fake", matchIfMissing = true)
public class FakePaymentGateway implements PaymentGateway {
    private final WoodstarProperties props;

    @Override
    public String createCheckout(Order order, String successUrl, String cancelUrl, String customerIp) {
        return props.getPublicBaseUrl() + "/api/dev/pay/" + order.getId();
    }

    @Override
    public void refund(Order order) {
        log.info("[fake payments] refund for order {} (no-op)", order.getOrderNumber());
    }

    @Override
    public String providerName() {
        return "fake";
    }
}
