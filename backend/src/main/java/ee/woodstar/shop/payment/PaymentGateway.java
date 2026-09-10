package ee.woodstar.shop.payment;

import ee.woodstar.shop.domain.Order;

public interface PaymentGateway {
    /**
     * Creates a checkout for the order and returns the URL the customer must be redirected to.
     * May set {@code order.paymentRef} to the provider's transaction id.
     *
     * @param customerIp the buyer's IP address (Maksekeskus requires it for fraud screening)
     */
    String createCheckout(Order order, String successUrl, String cancelUrl, String customerIp);

    void refund(Order order);

    String providerName();
}
