package ee.woodstar.shop.locker;

import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.repository.LockerRepository;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.MountableFile;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Runs the real broker with the repo's mosquitto.conf and entrypoint.sh, exactly as compose does. */
@Testcontainers
class BrokerLoginIT {

    @Container
    static final GenericContainer<?> broker = new GenericContainer<>("eclipse-mosquitto:2")
        .withCopyFileToContainer(MountableFile.forHostPath("../infra/mosquitto/mosquitto.conf"), "/mosquitto/config/mosquitto.conf")
        .withCopyFileToContainer(MountableFile.forHostPath("../infra/mosquitto/entrypoint.sh"), "/woodstar-entrypoint.sh")
        .withEnv("MQTT_USERNAME", "backend")
        .withEnv("MQTT_PASSWORD", "backend-secret")
        .withCreateContainerCmdModifier(c -> c.withEntrypoint("/bin/sh", "/woodstar-entrypoint.sh"))
        .withExposedPorts(1883)
        .waitingFor(Wait.forLogMessage(".*running mosquitto as user.*", 1));

    static MqttShellyLockerController controller;

    @BeforeAll
    static void connectBackend() {
        WoodstarProperties props = new WoodstarProperties();
        props.getMqtt().setHost(broker.getHost());
        props.getMqtt().setPort(broker.getMappedPort(1883));
        props.getMqtt().setUsername("backend");
        props.getMqtt().setPassword("backend-secret");
        LockerRepository lockers = mock(LockerRepository.class);
        when(lockers.findAll()).thenReturn(List.of());
        controller = new MqttShellyLockerController(props, lockers);
        controller.connectInBackground();
        // Connected and granted its role once a login can be created.
        await().atMost(Duration.ofSeconds(20)).ignoreExceptions()
            .until(() -> { controller.setDeviceLogin("probe-device", "x"); return true; });
    }

    @AfterAll
    static void shutdown() {
        controller.shutdown();
    }

    @Test
    void issuedLogin_letsTheDeviceConnect_andTheBackendOpenItsDoor() throws Exception {
        controller.setDeviceLogin("shellyplus1-it0001", "first-password");
        MqttClient device = connect("shellyplus1-it0001", "first-password");
        BlockingQueue<String> rpc = new LinkedBlockingQueue<>();
        // Answer like a Shelly would, off Paho's callback thread.
        device.subscribe("shellyplus1-it0001/rpc", 1, (topic, msg) -> rpc.add(new String(msg.getPayload(), StandardCharsets.UTF_8)));
        device.publish("shellyplus1-it0001/online", "true".getBytes(StandardCharsets.UTF_8), 1, true);
        await().atMost(Duration.ofSeconds(5)).until(() -> controller.isOnline("shellyplus1-it0001"));

        Thread responder = new Thread(() -> {
            try {
                String call = rpc.poll(5, TimeUnit.SECONDS);
                int id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(call).get("id").asInt();
                device.publish("woodstar-backend/rpc", ("{\"id\":" + id + ",\"src\":\"shellyplus1-it0001\",\"result\":{\"was_on\":false}}")
                    .getBytes(StandardCharsets.UTF_8), 1, false);
            } catch (Exception ignored) { }
        });
        responder.start();
        assertThat(controller.open("shellyplus1-it0001", 0, 2).ok()).isTrue();
        device.disconnect();
    }

    @Test
    void newPassword_replacesTheOldOne() throws Exception {
        controller.setDeviceLogin("shellyplus1-it0002", "old-password");
        connect("shellyplus1-it0002", "old-password").disconnect();
        controller.setDeviceLogin("shellyplus1-it0002", "new-password");
        assertThatThrownBy(() -> connect("shellyplus1-it0002", "old-password")).isInstanceOf(MqttException.class);
        connect("shellyplus1-it0002", "new-password").disconnect();
    }

    @Test
    void deletedLogin_isRefused() throws Exception {
        controller.setDeviceLogin("shellyplus1-it0003", "pw");
        controller.deleteDeviceLogin("shellyplus1-it0003");
        assertThatThrownBy(() -> connect("shellyplus1-it0003", "pw")).isInstanceOf(MqttException.class);
    }

    @Test
    void device_cannotCommandAnotherDevice() throws Exception {
        controller.setDeviceLogin("shellyplus1-it0004", "pw4");
        controller.setDeviceLogin("shellyplus1-it0005", "pw5");
        MqttClient victim = connect("shellyplus1-it0005", "pw5");
        BlockingQueue<String> received = new LinkedBlockingQueue<>();
        victim.subscribe("shellyplus1-it0005/rpc", 1, (t, m) -> received.add(new String(m.getPayload(), StandardCharsets.UTF_8)));
        MqttClient attacker = connect("shellyplus1-it0004", "pw4");
        attacker.publish("shellyplus1-it0005/rpc", "{\"id\":1,\"method\":\"Switch.Set\"}".getBytes(StandardCharsets.UTF_8), 1, false);
        assertThat(received.poll(1, TimeUnit.SECONDS)).isNull();
        attacker.disconnect();
        victim.disconnect();
    }

    private static MqttClient connect(String username, String password) throws MqttException {
        MqttClient c = new MqttClient("tcp://" + broker.getHost() + ":" + broker.getMappedPort(1883), username, new MemoryPersistence());
        MqttConnectOptions opts = new MqttConnectOptions();
        opts.setUserName(username);
        opts.setPassword(password.toCharArray());
        opts.setConnectionTimeout(5);
        c.connect(opts);
        return c;
    }
}
