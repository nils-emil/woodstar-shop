package ee.woodstar.shop.locker;

import com.fasterxml.jackson.databind.JsonNode;

/** Shelly Gen2+ RPC payload helpers. Pure functions so they can be unit tested without a broker. */
public final class ShellyRpc {
    public static final String SRC = "woodstar-backend";

    private ShellyRpc() {}

    public static String rpcTopic(String deviceId) {
        return deviceId + "/rpc";
    }

    public static String responseTopic() {
        return SRC + "/rpc";
    }

    public static String openPayload(int id, int channel, int pulseSeconds) {
        return "{\"id\":" + id + ",\"src\":\"" + SRC + "\",\"method\":\"Switch.Set\","
            + "\"params\":{\"id\":" + channel + ",\"on\":true,\"toggle_after\":" + pulseSeconds + "}}";
    }

    /** initial_state off + auto_off disabled so a power-cycled relay never leaves a door unlocked. */
    public static String safeConfigPayload(int id, int channel) {
        return "{\"id\":" + id + ",\"src\":\"" + SRC + "\",\"method\":\"Switch.SetConfig\","
            + "\"params\":{\"id\":" + channel + ",\"config\":{\"initial_state\":\"off\",\"auto_off\":false}}}";
    }

    /** Returns the error message from a response, or null if the response is a success. */
    public static String errorOf(JsonNode response) {
        JsonNode err = response.get("error");
        if (err == null || err.isNull()) return null;
        JsonNode msg = err.get("message");
        return msg != null ? msg.asText() : err.toString();
    }
}
