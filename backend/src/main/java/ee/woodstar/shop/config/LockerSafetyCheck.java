package ee.woodstar.shop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Refuses to start production with MQTT off, which would swap in the fake locker controller and report
 * doors as opened that never moved. Demo mode does not change this: on a server doors are always real.
 */
@Component
public class LockerSafetyCheck {
    public LockerSafetyCheck(Environment env, @Value("${woodstar.mqtt.enabled:false}") boolean mqttEnabled) {
        if (!mqttEnabled && env.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException("woodstar.mqtt.enabled=false is not allowed with the prod profile; "
                + "locker doors are never mocked on a server");
        }
    }
}
