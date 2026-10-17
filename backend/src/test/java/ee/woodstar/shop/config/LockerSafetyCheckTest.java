package ee.woodstar.shop.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LockerSafetyCheckTest {

    private static MockEnvironment env(String... profiles) {
        MockEnvironment e = new MockEnvironment();
        e.setActiveProfiles(profiles);
        return e;
    }

    @Test
    void prodWithMqttOff_refusesToStart() {
        assertThatThrownBy(() -> new LockerSafetyCheck(env("prod"), false)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void prodWithMqttOn_starts() {
        assertThatCode(() -> new LockerSafetyCheck(env("prod"), true)).doesNotThrowAnyException();
    }

    @Test
    void devWithMqttOff_starts() {
        assertThatCode(() -> new LockerSafetyCheck(env("dev"), false)).doesNotThrowAnyException();
    }
}
