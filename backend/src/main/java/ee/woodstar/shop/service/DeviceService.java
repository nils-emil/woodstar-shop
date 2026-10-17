package ee.woodstar.shop.service;

import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.domain.DeviceLogin;
import ee.woodstar.shop.locker.BrokerAccounts;
import ee.woodstar.shop.locker.Dynsec;
import ee.woodstar.shop.repository.DeviceLoginRepository;
import ee.woodstar.shop.web.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Base64;

/** Broker logins for Shelly devices: the app creates them so nobody edits broker files by hand. */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final DeviceLoginRepository logins;
    private final BrokerAccounts broker;
    private final WoodstarProperties props;
    private final Clock clock;

    /** What the admin types into the Shelly. The password is only ever returned here, once. */
    public record IssuedLogin(String deviceId, String server, String username, String password, boolean live) {}

    /**
     * Creates the device's login, or replaces its password when it already has one. The broker is changed
     * first: if saving the row then fails, the broker merely has a login the app does not list yet.
     * Not transactional on purpose: no DB connection is held while waiting up to 5 s for the broker.
     */
    public IssuedLogin issueLogin(String rawDeviceId, String actor) {
        String deviceId = validDeviceId(rawDeviceId);
        String password = newPassword();
        try {
            broker.setDeviceLogin(deviceId, password);
        } catch (BrokerAccounts.BrokerException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "BROKER_UNREACHABLE", e.getMessage());
        }
        DeviceLogin login = logins.findById(deviceId).orElseGet(() -> DeviceLogin.builder().deviceId(deviceId).build());
        login.setIssuedAt(clock.instant());
        login.setIssuedBy(actor);
        logins.save(login);
        log.info("Broker login for {} issued by {}", deviceId, actor);
        return new IssuedLogin(deviceId, brokerAddress(), deviceId, password, broker.isLive());
    }

    public void revokeLogin(String rawDeviceId, String actor) {
        String deviceId = validDeviceId(rawDeviceId);
        try {
            broker.deleteDeviceLogin(deviceId);
        } catch (BrokerAccounts.BrokerException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "BROKER_UNREACHABLE", e.getMessage());
        }
        logins.deleteById(deviceId);
        log.info("Broker login for {} removed by {}", deviceId, actor);
    }

    /** host:port as the Shelly's MQTT "Server" field wants it. */
    public String brokerAddress() {
        String host = props.getMqtt().getPublicHost();
        if (host == null || host.isBlank()) host = URI.create(props.getPublicBaseUrl()).getHost();
        return host + ":" + props.getMqtt().getPublicPort();
    }

    private static String validDeviceId(String raw) {
        String id = raw == null ? "" : raw.trim();
        if (!Dynsec.DEVICE_ID.matcher(id).matches()) {
            throw ApiException.badRequest("INVALID_DEVICE_ID",
                "Device id must be 3–64 letters, digits or dashes, e.g. shellyplus1-a8032abcdef0");
        }
        return id;
    }

    /** 32 URL-safe characters: easy to paste into the Shelly UI and into a setup link. */
    private static String newPassword() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
