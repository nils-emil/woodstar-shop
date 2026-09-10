package ee.woodstar.shop.locker;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Simulates lockers when no MQTT broker is configured. Device ids containing "offline" fail. */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "woodstar.mqtt", name = "enabled", havingValue = "false", matchIfMissing = true)
public class FakeLockerController implements LockerController {

    @Override
    public OpenResult open(String deviceId, int channel, int pulseSeconds) {
        if (!isOnline(deviceId)) {
            log.warn("[fake locker] {} is offline", deviceId);
            return OpenResult.failure("device offline (fake)");
        }
        try {
            Thread.sleep(300);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        log.info("[fake locker] opened {} channel {} for {}s", deviceId, channel, pulseSeconds);
        return OpenResult.success("fake open");
    }

    @Override
    public boolean isOnline(String deviceId) {
        return deviceId == null || !deviceId.toLowerCase().contains("offline");
    }
}
