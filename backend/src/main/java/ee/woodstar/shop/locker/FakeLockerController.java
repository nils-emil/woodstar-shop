package ee.woodstar.shop.locker;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Simulates lockers and broker logins when no MQTT broker is configured. Device ids containing "offline" fail. */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "woodstar.mqtt", name = "enabled", havingValue = "false", matchIfMissing = true)
public class FakeLockerController implements LockerController, BrokerAccounts {

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

    @Override
    public void setDeviceLogin(String deviceId, String password) {
        Dynsec.requireValidDeviceId(deviceId);
        log.info("[fake broker] login set for {} (not enforced: MQTT is off)", deviceId);
    }

    @Override
    public void deleteDeviceLogin(String deviceId) {
        log.info("[fake broker] login removed for {}", deviceId);
    }

    @Override
    public boolean isLive() {
        return false;
    }
}
