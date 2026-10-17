package ee.woodstar.shop.locker;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.domain.Locker;
import ee.woodstar.shop.repository.LockerRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Drives Shelly Gen2+ relays over MQTT RPC. Publishes Switch.Set pulses to <deviceId>/rpc and
 * correlates the reply that arrives on woodstar-backend/rpc by request id. Tracks device online
 * state from the retained <deviceId>/online topic. As the broker's Dynamic Security admin it also
 * creates the per-device logins ({@link BrokerAccounts}) over the same connection.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "woodstar.mqtt", name = "enabled", havingValue = "true")
public class MqttShellyLockerController implements LockerController, BrokerAccounts, MqttCallbackExtended {

    private final WoodstarProperties.Mqtt config;
    private final LockerRepository lockerRepository;
    private final ObjectMapper json = new ObjectMapper();
    private final AtomicInteger requestId = new AtomicInteger(1);
    private final Map<Integer, CompletableFuture<JsonNode>> pending = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<JsonNode>> pendingControl = new ConcurrentHashMap<>();
    private final Map<String, Boolean> online = new ConcurrentHashMap<>();
    /** Publishing from Paho's callback thread deadlocks the client, so config pushes run here. */
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "mqtt-shelly");
        t.setDaemon(true);
        return t;
    });
    private final Duration rpcTimeout;
    private volatile IMqttClient client;

    @org.springframework.beans.factory.annotation.Autowired
    public MqttShellyLockerController(WoodstarProperties props, LockerRepository lockerRepository) {
        this.config = props.getMqtt();
        this.lockerRepository = lockerRepository;
        this.rpcTimeout = Duration.ofSeconds(config.getRpcTimeoutSeconds());
    }

    /** Test constructor: pre-connected (mock) client, no background connect. */
    MqttShellyLockerController(WoodstarProperties props, LockerRepository lockerRepository, IMqttClient client) {
        this(props, lockerRepository);
        this.client = client;
    }

    @PostConstruct
    void connectInBackground() {
        executor.execute(this::connect);
    }

    private void connect() {
        try {
            String uri = (config.isTls() ? "ssl" : "tcp") + "://" + config.getHost() + ":" + config.getPort();
            MqttClient c = new MqttClient(uri, clientId(), null);
            MqttConnectOptions opts = new MqttConnectOptions();
            if (config.getUsername() != null && !config.getUsername().isBlank()) {
                opts.setUserName(config.getUsername());
                opts.setPassword(config.getPassword().toCharArray());
            }
            opts.setAutomaticReconnect(true);
            opts.setCleanSession(true);
            opts.setConnectionTimeout(10);
            c.setCallback(this);
            c.connect(opts);
            this.client = c;
            subscribe(c);
            log.info("MQTT connected to {} as {}", uri, c.getClientId());
            executor.execute(this::afterConnect);
        } catch (MqttException e) {
            // Startup must not fail; door opens surface DEVICE_UNREACHABLE until the broker is back.
            log.warn("MQTT connect failed ({}); Paho will not retry an initial failure, retrying in 15s", e.getMessage());
            CompletableFuture.delayedExecutor(15, TimeUnit.SECONDS, executor).execute(this::connect);
        }
    }

    private String clientId() {
        String host = System.getenv("HOSTNAME");
        String suffix = (host == null || host.isBlank()) ? UUID.randomUUID().toString() : host;
        return config.getClientIdPrefix() + "-" + suffix;
    }

    private void subscribe(IMqttClient c) throws MqttException {
        c.subscribe("+/online", 1);
        c.subscribe(ShellyRpc.responseTopic(), 1);
        c.subscribe(Dynsec.RESPONSE_TOPIC, 1);
    }

    /** Runs on the executor: the role grant waits for the broker's reply, which arrives on Paho's thread. */
    private void afterConnect() {
        ensureBackendRole();
        pushSafeConfigToKnownDevices();
    }

    /** The broker's init only lets the backend manage logins; this grants it publishing to <deviceId>/rpc. */
    void ensureBackendRole() {
        try {
            JsonNode r = control(correlation -> Dynsec.backendRoleCommands(correlation, config.getUsername()));
            log.debug("Backend role ensured: {}", r);
        } catch (BrokerException e) {
            log.warn("Could not grant the backend its broker role ({}); door opens will not reach devices", e.getMessage());
        }
    }

    void pushSafeConfigToKnownDevices() {
        IMqttClient c = client;
        if (c == null || !c.isConnected()) return;
        List<Locker> lockers;
        try {
            lockers = lockerRepository.findAll();
        } catch (Exception e) {
            log.warn("Could not load lockers for MQTT config push: {}", e.getMessage());
            return;
        }
        for (Locker l : lockers) {
            try {
                String payload = ShellyRpc.safeConfigPayload(requestId.getAndIncrement(), l.getRelayChannel());
                c.publish(ShellyRpc.rpcTopic(l.getShellyDeviceId()), payload.getBytes(StandardCharsets.UTF_8), 1, false);
            } catch (MqttException e) {
                log.warn("Config push to {} failed: {}", l.getShellyDeviceId(), e.getMessage());
            }
        }
    }

    @Override
    public OpenResult open(String deviceId, int channel, int pulseSeconds) {
        IMqttClient c = client;
        if (c == null || !c.isConnected()) {
            return OpenResult.failure("MQTT broker not connected");
        }
        int id = requestId.getAndIncrement();
        CompletableFuture<JsonNode> future = new CompletableFuture<>();
        pending.put(id, future);
        try {
            String payload = ShellyRpc.openPayload(id, channel, pulseSeconds);
            c.publish(ShellyRpc.rpcTopic(deviceId), payload.getBytes(StandardCharsets.UTF_8), 1, false);
            JsonNode response = future.get(rpcTimeout.toMillis(), TimeUnit.MILLISECONDS);
            String error = ShellyRpc.errorOf(response);
            if (error != null) {
                return OpenResult.failure("device error: " + error);
            }
            return OpenResult.success("rpc id " + id + " acknowledged");
        } catch (MqttException e) {
            return OpenResult.failure("publish failed: " + e.getMessage());
        } catch (TimeoutException e) {
            return OpenResult.failure("no response from device within " + rpcTimeout.toSeconds() + "s");
        } catch (ExecutionException e) {
            return OpenResult.failure("rpc failed: " + e.getCause().getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return OpenResult.failure("interrupted");
        } finally {
            pending.remove(id);
        }
    }

    @Override
    public boolean isOnline(String deviceId) {
        return online.getOrDefault(deviceId, false);
    }

    // --- MqttCallbackExtended

    @Override
    public void connectComplete(boolean reconnect, String serverURI) {
        if (!reconnect) return;
        IMqttClient c = client;
        if (c == null) return;
        try {
            subscribe(c);
            log.info("MQTT reconnected to {}", serverURI);
        } catch (MqttException e) {
            log.warn("Resubscribe after reconnect failed: {}", e.getMessage());
        }
        executor.execute(this::afterConnect);
    }

    @Override
    public void connectionLost(Throwable cause) {
        log.warn("MQTT connection lost: {}", cause == null ? "unknown" : cause.getMessage());
        pending.values().forEach(f -> f.completeExceptionally(new IllegalStateException("connection lost")));
        pendingControl.values().forEach(f -> f.completeExceptionally(new IllegalStateException("connection lost")));
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) {
        String body = new String(message.getPayload(), StandardCharsets.UTF_8);
        if (topic.endsWith("/online")) {
            String deviceId = topic.substring(0, topic.length() - "/online".length());
            boolean isOnline = "true".equalsIgnoreCase(body.trim());
            Boolean prev = online.put(deviceId, isOnline);
            if (prev == null || prev != isOnline) {
                log.info("Device {} is now {}", deviceId, isOnline ? "online" : "offline");
            }
            return;
        }
        if (topic.equals(ShellyRpc.responseTopic())) {
            handleRpcResponse(body);
        } else if (topic.equals(Dynsec.RESPONSE_TOPIC)) {
            handleControlResponse(body);
        }
    }

    /** Package-private so unit tests can feed responses without a live client. */
    void handleRpcResponse(String body) {
        try {
            JsonNode node = json.readTree(body);
            JsonNode idNode = node.get("id");
            if (idNode == null) return;
            CompletableFuture<JsonNode> f = pending.get(idNode.asInt());
            if (f != null) f.complete(node);
        } catch (Exception e) {
            log.warn("Unparseable RPC response: {}", body);
        }
    }

    /** Package-private so unit tests can feed broker replies without a live client. */
    void handleControlResponse(String body) {
        try {
            JsonNode node = json.readTree(body);
            String correlation = Dynsec.correlationOf(node);
            CompletableFuture<JsonNode> f = correlation == null ? null : pendingControl.get(correlation);
            if (f != null) f.complete(node);
        } catch (Exception e) {
            log.warn("Unparseable dynamic-security response: {}", body);
        }
    }

    // --- BrokerAccounts

    @Override
    public void setDeviceLogin(String deviceId, String password) {
        JsonNode r = control(correlation -> Dynsec.deviceLoginCommands(correlation, deviceId, password));
        // Delete-then-create: the deletes fail harmlessly for a device that never had a login.
        List<String> errors = Dynsec.errorsOf(r, Set.of("deleteClient", "deleteRole"));
        if (!errors.isEmpty()) throw new BrokerException("broker refused the login: " + String.join("; ", errors));
        log.info("Broker login set for device {}", deviceId);
    }

    @Override
    public void deleteDeviceLogin(String deviceId) {
        control(correlation -> Dynsec.deleteDeviceCommands(correlation, deviceId));
        log.info("Broker login removed for device {}", deviceId);
    }

    @Override
    public boolean isLive() {
        return true;
    }

    /** Publishes one control message and waits for the broker's answer. Never call on Paho's callback thread. */
    private JsonNode control(java.util.function.Function<String, String> commands) {
        IMqttClient c = client;
        if (c == null || !c.isConnected()) throw new BrokerException("MQTT broker not connected");
        String correlation = UUID.randomUUID().toString();
        CompletableFuture<JsonNode> future = new CompletableFuture<>();
        pendingControl.put(correlation, future);
        try {
            c.publish(Dynsec.TOPIC, commands.apply(correlation).getBytes(StandardCharsets.UTF_8), 1, false);
            return future.get(rpcTimeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (MqttException e) {
            throw new BrokerException("publish failed: " + e.getMessage());
        } catch (TimeoutException e) {
            // Also what a backend user without dynamic-security admin rights sees: the broker drops the message.
            throw new BrokerException("no answer from the broker within " + rpcTimeout.toSeconds() + "s");
        } catch (ExecutionException e) {
            throw new BrokerException("broker request failed: " + e.getCause().getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BrokerException("interrupted");
        } finally {
            pendingControl.remove(correlation);
        }
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) { }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
        IMqttClient c = client;
        if (c != null) {
            try {
                if (c.isConnected()) c.disconnect();
                c.close();
            } catch (MqttException ignored) { }
        }
    }
}
