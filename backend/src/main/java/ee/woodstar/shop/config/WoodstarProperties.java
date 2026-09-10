package ee.woodstar.shop.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "woodstar")
@Getter @Setter
public class WoodstarProperties {
    private String publicBaseUrl = "http://localhost:3000";
    private boolean seedDemoData = false;
    private Admin admin = new Admin();
    private Payments payments = new Payments();
    private Mqtt mqtt = new Mqtt();
    private Mail mail = new Mail();
    private Pickup pickup = new Pickup();
    private Order order = new Order();

    @Getter @Setter public static class Admin { private String username = "admin"; private String password = "admin"; }
    @Getter @Setter public static class Payments { private String provider = "fake"; private Maksekeskus maksekeskus = new Maksekeskus(); }
    @Getter @Setter public static class Maksekeskus {
        private String shopId = "";
        private String secretKey = "";
        /** Test environment: https://api.test.maksekeskus.ee/v1 */
        private String baseUrl = "https://api.maksekeskus.ee/v1";
    }
    @Getter @Setter public static class Mqtt {
        private boolean enabled = false;
        private String host = "localhost";
        private int port = 1883;
        private String username = "backend";
        private String password = "backend";
        private boolean tls = false;
        private String clientIdPrefix = "woodstar-backend";
        private int rpcTimeoutSeconds = 5;
    }
    @Getter @Setter public static class Mail { private String from = "noreply@woodstar.ee"; }
    @Getter @Setter public static class Pickup { private int deadlineHours = 48; private int reopenWindowMinutes = 30; private int maxOpens = 5; }
    @Getter @Setter public static class Order { private int reservationTtlMinutes = 15; }
}
