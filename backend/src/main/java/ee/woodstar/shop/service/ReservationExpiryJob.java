package ee.woodstar.shop.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReservationExpiryJob {
    private final OrderService orderService;

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void run() {
        try {
            int n = orderService.expireStaleReservations();
            if (n > 0) log.info("Expired {} stale reservation(s)", n);
        } catch (Exception e) {
            log.error("Reservation expiry job failed: {}", e.getMessage(), e);
        }
    }
}
