package ee.woodstar.shop.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Refuses to start production with the fake provider, which marks every order paid without taking
 * money, unless demo mode is switched on explicitly (a test server: no money taken, but the doors are real).
 */
@Slf4j
@Component
public class PaymentSafetyCheck {
    public PaymentSafetyCheck(Environment env,
                              @Value("${woodstar.payments.provider:none}") String provider,
                              @Value("${woodstar.demo-mode:false}") boolean demoMode) {
        boolean fake = "fake".equalsIgnoreCase(provider);
        if (fake && demoMode) {
            log.warn("DEMO MODE: payments are mocked, no money is taken");
        } else if (fake && env.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException("woodstar.payments.provider=fake is not allowed with the prod profile; "
                + "use none or maksekeskus, or set woodstar.demo-mode=true on a test server");
        }
    }
}
