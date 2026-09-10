package ee.woodstar.shop.locker;

import com.fasterxml.jackson.databind.ObjectMapper;
import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.repository.LockerRepository;
import org.eclipse.paho.client.mqttv3.IMqttClient;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MqttPayloadTest {

    private final ObjectMapper json = new ObjectMapper();
    private IMqttClient client;
    private MqttShellyLockerController controller;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    @BeforeEach
    void setUp() {
        WoodstarProperties props = new WoodstarProperties();
        props.getMqtt().setRpcTimeoutSeconds(1);
        client = mock(IMqttClient.class);
        when(client.isConnected()).thenReturn(true);
        controller = new MqttShellyLockerController(props, mock(LockerRepository.class), client);
    }

    @Test
    void openPayload_isShellySwitchSetWithPulse() throws Exception {
        String payload = ShellyRpc.openPayload(7, 1, 3);
        var node = json.readTree(payload);
        assertThat(node.get("id").asInt()).isEqualTo(7);
        assertThat(node.get("src").asText()).isEqualTo("woodstar-backend");
        assertThat(node.get("method").asText()).isEqualTo("Switch.Set");
        assertThat(node.get("params").get("id").asInt()).isEqualTo(1);
        assertThat(node.get("params").get("on").asBoolean()).isTrue();
        assertThat(node.get("params").get("toggle_after").asInt()).isEqualTo(3);
        assertThat(ShellyRpc.rpcTopic("shellyplus1-abc")).isEqualTo("shellyplus1-abc/rpc");
        assertThat(ShellyRpc.responseTopic()).isEqualTo("woodstar-backend/rpc");
    }

    @Test
    void safeConfigPayload_disablesAutoOffAndSetsInitialStateOff() throws Exception {
        var node = json.readTree(ShellyRpc.safeConfigPayload(3, 0));
        assertThat(node.get("method").asText()).isEqualTo("Switch.SetConfig");
        assertThat(node.get("params").get("config").get("initial_state").asText()).isEqualTo("off");
        assertThat(node.get("params").get("config").get("auto_off").asBoolean()).isFalse();
    }

    @Test
    void open_timesOut_whenNoResponse() throws Exception {
        LockerController.OpenResult r = controller.open("dev-1", 0, 2);
        assertThat(r.ok()).isFalse();
        assertThat(r.detail()).contains("no response");
        verify(client).publish(eq("dev-1/rpc"), any(byte[].class), eq(1), eq(false));
    }

    @Test
    void open_succeeds_whenMatchingIdResponseArrives() throws Exception {
        answerWith("{\"id\":%d,\"src\":\"dev-1\",\"dst\":\"woodstar-backend\",\"result\":{\"was_on\":false}}");
        LockerController.OpenResult r = controller.open("dev-1", 0, 2);
        assertThat(r.ok()).isTrue();
    }

    @Test
    void open_fails_whenDeviceReturnsError() throws Exception {
        answerWith("{\"id\":%d,\"src\":\"dev-1\",\"dst\":\"woodstar-backend\",\"error\":{\"code\":-103,\"message\":\"Invalid argument\"}}");
        LockerController.OpenResult r = controller.open("dev-1", 0, 2);
        assertThat(r.ok()).isFalse();
        assertThat(r.detail()).contains("Invalid argument");
    }

    @Test
    void open_ignoresResponseWithOtherId() throws Exception {
        answerWith("{\"id\":999999,\"src\":\"dev-1\",\"result\":{}}");
        LockerController.OpenResult r = controller.open("dev-1", 0, 2);
        assertThat(r.ok()).isFalse();
    }

    @Test
    void open_fails_whenNotConnected() {
        when(client.isConnected()).thenReturn(false);
        LockerController.OpenResult r = controller.open("dev-1", 0, 2);
        assertThat(r.ok()).isFalse();
        assertThat(r.detail()).contains("not connected");
    }

    @Test
    void onlineTopic_updatesOnlineMap() throws Exception {
        controller.messageArrived("shellyplus1-abc/online", new org.eclipse.paho.client.mqttv3.MqttMessage("true".getBytes(StandardCharsets.UTF_8)));
        assertThat(controller.isOnline("shellyplus1-abc")).isTrue();
        controller.messageArrived("shellyplus1-abc/online", new org.eclipse.paho.client.mqttv3.MqttMessage("false".getBytes(StandardCharsets.UTF_8)));
        assertThat(controller.isOnline("shellyplus1-abc")).isFalse();
        assertThat(controller.isOnline("unknown")).isFalse();
    }

    /** Simulates the device replying (asynchronously) to whatever request id was published. */
    private void answerWith(String responseTemplate) throws MqttException {
        ArgumentCaptor<byte[]> captor = ArgumentCaptor.forClass(byte[].class);
        doAnswer(inv -> {
            byte[] payload = inv.getArgument(1);
            int id = json.readTree(new String(payload, StandardCharsets.UTF_8)).get("id").asInt();
            String response = responseTemplate.contains("%d") ? responseTemplate.formatted(id) : responseTemplate;
            scheduler.schedule(() -> controller.handleRpcResponse(response), 50, TimeUnit.MILLISECONDS);
            return null;
        }).when(client).publish(anyString(), captor.capture(), anyInt(), anyBoolean());
    }
}
