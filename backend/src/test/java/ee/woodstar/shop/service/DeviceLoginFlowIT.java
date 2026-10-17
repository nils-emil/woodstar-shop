package ee.woodstar.shop.service;

import ee.woodstar.shop.PostgresTestSupport;
import ee.woodstar.shop.repository.DeviceLoginRepository;
import ee.woodstar.shop.web.AdminController;
import ee.woodstar.shop.web.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** MQTT is off in tests, so the fake broker accepts logins; BrokerLoginIT covers the real one. */
@SpringBootTest(properties = "woodstar.public-base-url=https://puukapp.ee")
@ActiveProfiles("test")
@Import(PostgresTestSupport.class)
class DeviceLoginFlowIT {

    @Autowired DeviceService deviceService;
    @Autowired AdminController adminController;
    @Autowired DeviceLoginRepository logins;

    @BeforeEach
    void clean() {
        logins.deleteAll();
    }

    @Test
    void issuedLogin_isListed_andEachIssueGivesANewPassword() {
        DeviceService.IssuedLogin first = deviceService.issueLogin("  shellypro4pm-a8032abcdef0 ", "admin");
        assertThat(first.server()).isEqualTo("puukapp.ee:1883");
        assertThat(first.username()).isEqualTo("shellypro4pm-a8032abcdef0");
        assertThat(first.password()).hasSize(32).matches("[A-Za-z0-9_-]+");
        assertThat(first.live()).isFalse();

        var device = adminController.devices().stream()
            .filter(d -> d.deviceId().equals("shellypro4pm-a8032abcdef0")).findFirst().orElseThrow();
        assertThat(device.loginIssuedAt()).isNotNull();
        assertThat(device.lockers()).isEmpty();

        DeviceService.IssuedLogin second = deviceService.issueLogin("shellypro4pm-a8032abcdef0", "admin");
        assertThat(second.password()).isNotEqualTo(first.password());
        assertThat(logins.count()).isEqualTo(1);

        deviceService.revokeLogin("shellypro4pm-a8032abcdef0", "admin");
        assertThat(logins.count()).isZero();
    }

    @Test
    void deviceIdWithWildcards_isRejected() {
        assertThatThrownBy(() -> deviceService.issueLogin("#", "admin"))
            .isInstanceOf(ApiException.class).hasMessageContaining("letters, digits or dashes");
        assertThat(logins.count()).isZero();
    }
}
