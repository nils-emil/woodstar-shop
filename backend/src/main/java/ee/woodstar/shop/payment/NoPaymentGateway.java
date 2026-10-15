package ee.woodstar.shop.payment;

import ee.woodstar.shop.domain.Order;
import ee.woodstar.shop.web.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * No payment provider configured: the shop is browsable but sales are closed. This is the
 * default, so a server without payment settings never hands out lockers for free.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "woodstar.payments", name = "provider", havingValue = "none", matchIfMissing = true)
public class NoPaymentGateway implements PaymentGateway {

    @Override
    public boolean acceptsPayments() {
        return false;
    }

    @Override
    public String createCheckout(Order order, String successUrl, String cancelUrl, String customerIp) {
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "SALES_CLOSED", "Sales are not open yet");
    }

    @Override
    public void refund(Order order) {
        log.warn("[no payments] refund requested for order {}; nothing to refund through a provider", order.getOrderNumber());
    }

    @Override
    public String providerName() {
        return "none";
    }
}
