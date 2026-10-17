package ee.woodstar.shop.locker;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Mosquitto Dynamic Security control messages. Pure functions so they can be unit tested without a broker.
 * One message carries several commands; the broker answers all of them in one message on {@link #RESPONSE_TOPIC},
 * each echoing our correlationData.
 */
public final class Dynsec {
    public static final String TOPIC = "$CONTROL/dynamic-security/v1";
    public static final String RESPONSE_TOPIC = TOPIC + "/response";
    /** Role that lets the backend send RPC calls to every device; the broker's init only grants it $CONTROL. */
    public static final String BACKEND_ROLE = "woodstar-backend";
    /** Letters, digits and dashes only, so an id can never smuggle MQTT wildcards (+ #) or levels (/) into an ACL. */
    public static final Pattern DEVICE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9-]{2,63}");

    private static final ObjectMapper JSON = new ObjectMapper();

    private Dynsec() {}

    public static String deviceRole(String deviceId) {
        return "device-" + deviceId;
    }

    public static void requireValidDeviceId(String deviceId) {
        if (deviceId == null || !DEVICE_ID.matcher(deviceId).matches()) {
            throw new IllegalArgumentException("invalid device id: " + deviceId);
        }
    }

    /** Idempotent: errors such as "Role already exists" are expected on every start after the first. */
    public static String backendRoleCommands(String correlation, String backendUsername) {
        Commands c = new Commands(correlation);
        c.add("createRole").put("rolename", BACKEND_ROLE);
        c.acl(BACKEND_ROLE, "publishClientSend", "+/rpc");
        c.add("addClientRole").put("username", backendUsername).put("rolename", BACKEND_ROLE);
        return c.toJson();
    }

    /**
     * Delete-then-create, so the same message both creates a new login and rotates an existing one (deleting the
     * client also disconnects the device). The device may only publish below its own id and answer the backend.
     */
    public static String deviceLoginCommands(String correlation, String deviceId, String password) {
        requireValidDeviceId(deviceId);
        String role = deviceRole(deviceId);
        Commands c = new Commands(correlation);
        c.add("deleteClient").put("username", deviceId);
        c.add("deleteRole").put("rolename", role);
        c.add("createRole").put("rolename", role);
        c.acl(role, "publishClientSend", deviceId + "/#");
        c.acl(role, "publishClientSend", ShellyRpc.responseTopic());
        c.acl(role, "subscribePattern", deviceId + "/#");
        ObjectNode client = c.add("createClient").put("username", deviceId).put("password", password);
        client.putArray("roles").addObject().put("rolename", role);
        return c.toJson();
    }

    public static String deleteDeviceCommands(String correlation, String deviceId) {
        requireValidDeviceId(deviceId);
        Commands c = new Commands(correlation);
        c.add("deleteClient").put("username", deviceId);
        c.add("deleteRole").put("rolename", deviceRole(deviceId));
        return c.toJson();
    }

    /** Returns the correlationData of a response message, or null if it has none. */
    public static String correlationOf(JsonNode response) {
        JsonNode responses = response.get("responses");
        if (responses == null || !responses.isArray() || responses.isEmpty()) return null;
        JsonNode cd = responses.get(0).get("correlationData");
        return cd == null ? null : cd.asText();
    }

    /** "command: error" for every failed command, except the ones listed as expected to fail. */
    public static List<String> errorsOf(JsonNode response, Set<String> mayFail) {
        List<String> errors = new ArrayList<>();
        for (JsonNode r : response.path("responses")) {
            JsonNode err = r.get("error");
            String command = r.path("command").asText();
            if (err != null && !err.isNull() && !mayFail.contains(command)) errors.add(command + ": " + err.asText());
        }
        return errors;
    }

    private static final class Commands {
        private final String correlation;
        private final ObjectNode root = JSON.createObjectNode();
        private final ArrayNode list = root.putArray("commands");

        Commands(String correlation) { this.correlation = correlation; }

        ObjectNode add(String command) {
            return list.addObject().put("command", command).put("correlationData", correlation);
        }

        void acl(String role, String type, String topic) {
            add("addRoleACL").put("rolename", role).put("acltype", type).put("topic", topic).put("allow", true);
        }

        String toJson() { return root.toString(); }
    }
}
