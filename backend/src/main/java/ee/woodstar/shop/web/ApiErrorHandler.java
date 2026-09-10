package ee.woodstar.shop.web;

import ee.woodstar.shop.payment.PaymentException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

@Slf4j
@RestControllerAdvice
public class ApiErrorHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> api(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getCode(), "message", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> validation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
            .map(f -> f.getField() + ": " + f.getDefaultMessage())
            .findFirst().orElse("Validation failed");
        return ResponseEntity.badRequest().body(Map.of("error", "VALIDATION", "message", msg));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> unreadable(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "VALIDATION", "message", "Malformed request body"));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> noResource(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "NOT_FOUND", "message", "Not found"));
    }

    @ExceptionHandler(PaymentException.class)
    public ResponseEntity<Map<String, String>> payment(PaymentException e) {
        log.error("Payment error: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "PAYMENT_FAILED", "message", e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> other(Exception e) {
        log.error("Unhandled error: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(Map.of("error", "INTERNAL", "message", "Unexpected error"));
    }
}
