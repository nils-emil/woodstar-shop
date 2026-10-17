package ee.woodstar.shop.locker;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DynsecTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void deviceLogin_recreatesClientWithRoleLimitedToItsOwnTopics() throws Exception {
        JsonNode commands = json.readTree(Dynsec.deviceLoginCommands("c1", "shellyplus1-abc", "pw")).get("commands");
        assertThat(names(commands)).containsExactly("deleteClient", "deleteRole", "createRole",
            "addRoleACL", "addRoleACL", "addRoleACL", "createClient");
        commands.forEach(c -> assertThat(c.get("correlationData").asText()).isEqualTo("c1"));
        List<String> acls = new ArrayList<>();
        commands.forEach(c -> { if (c.has("acltype")) acls.add(c.get("acltype").asText() + " " + c.get("topic").asText()); });
        assertThat(acls).containsExactly("publishClientSend shellyplus1-abc/#", "publishClientSend woodstar-backend/rpc",
            "subscribePattern shellyplus1-abc/#");
        JsonNode create = commands.get(6);
        assertThat(create.get("username").asText()).isEqualTo("shellyplus1-abc");
        assertThat(create.get("password").asText()).isEqualTo("pw");
        assertThat(create.get("roles").get(0).get("rolename").asText()).isEqualTo("device-shellyplus1-abc");
    }

    @Test
    void deviceIds_withWildcardsOrLevels_areRejected() {
        for (String bad : new String[] {"#", "a/+", "dev/1", "x", "", "dev 1", "dev#1"}) {
            assertThatThrownBy(() -> Dynsec.deviceLoginCommands("c", bad, "pw")).isInstanceOf(IllegalArgumentException.class);
        }
        Dynsec.requireValidDeviceId("shellypro4pm-a8032abcdef0");
    }

    @Test
    void backendRole_allowsPublishingRpcToDevices() throws Exception {
        JsonNode commands = json.readTree(Dynsec.backendRoleCommands("c2", "backend")).get("commands");
        assertThat(names(commands)).containsExactly("createRole", "addRoleACL", "addClientRole");
        assertThat(commands.get(1).get("topic").asText()).isEqualTo("+/rpc");
        assertThat(commands.get(2).get("username").asText()).isEqualTo("backend");
    }

    @Test
    void errorsOf_skipsCommandsThatMayFail() throws Exception {
        JsonNode r = json.readTree("""
            {"responses":[{"command":"deleteClient","error":"Client not found","correlationData":"7"},
                          {"command":"createClient","error":"Client already exists","correlationData":"7"},
                          {"command":"createRole","correlationData":"7"}]}""");
        assertThat(Dynsec.correlationOf(r)).isEqualTo("7");
        assertThat(Dynsec.errorsOf(r, Set.of("deleteClient"))).containsExactly("createClient: Client already exists");
    }

    private static List<String> names(JsonNode commands) {
        List<String> out = new ArrayList<>();
        commands.forEach(c -> out.add(c.get("command").asText()));
        return out;
    }
}
