package ee.woodstar.shop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/** Refuses to start production with the fake provider, which marks every order paid without taking money. */
@Component
public class PaymentSafetyCheck {
    public PaymentSafetyCheck(Environment env, @Value("${woodstar.payments.provider:none}") String provider) {
        if (env.acceptsProfiles(Profiles.of("prod")) && "fake".equalsIgnoreCase(provider)) {
            throw new IllegalStateException("woodstar.payments.provider=fake is not allowed with the prod profile; use none or maksekeskus");
        }
    }
}
