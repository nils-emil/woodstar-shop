package ee.woodstar.shop.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PaymentSafetyCheckTest {

    private static MockEnvironment env(String... profiles) {
        MockEnvironment e = new MockEnvironment();
        e.setActiveProfiles(profiles);
        return e;
    }

    @Test
    void prodWithFakePayments_refusesToStart() {
        assertThatThrownBy(() -> new PaymentSafetyCheck(env("prod"), "fake", false)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void prodWithoutProvider_orMaksekeskus_starts() {
        assertThatCode(() -> new PaymentSafetyCheck(env("prod"), "none", false)).doesNotThrowAnyException();
        assertThatCode(() -> new PaymentSafetyCheck(env("prod"), "maksekeskus", false)).doesNotThrowAnyException();
    }

    @Test
    void devWithFakePayments_starts() {
        assertThatCode(() -> new PaymentSafetyCheck(env("dev"), "fake", false)).doesNotThrowAnyException();
    }

    @Test
    void prodWithFakePayments_inDemoMode_starts() {
        assertThatCode(() -> new PaymentSafetyCheck(env("prod"), "fake", true)).doesNotThrowAnyException();
    }
}
