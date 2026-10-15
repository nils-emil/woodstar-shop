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
        assertThatThrownBy(() -> new PaymentSafetyCheck(env("prod"), "fake")).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void prodWithoutProvider_orMaksekeskus_starts() {
        assertThatCode(() -> new PaymentSafetyCheck(env("prod"), "none")).doesNotThrowAnyException();
        assertThatCode(() -> new PaymentSafetyCheck(env("prod"), "maksekeskus")).doesNotThrowAnyException();
    }

    @Test
    void devWithFakePayments_starts() {
        assertThatCode(() -> new PaymentSafetyCheck(env("dev"), "fake")).doesNotThrowAnyException();
    }
}
