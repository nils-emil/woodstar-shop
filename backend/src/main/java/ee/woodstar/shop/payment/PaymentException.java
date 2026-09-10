package ee.woodstar.shop.payment;

public class PaymentException extends RuntimeException {
    public PaymentException(String message, Throwable cause) {
        super(message, cause);
    }
}
