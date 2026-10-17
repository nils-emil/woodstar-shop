package ee.woodstar.shop.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** A Shelly's MQTT broker login. The password is never stored here, only in the broker. */
@Entity
@Table(name = "device_login")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DeviceLogin {
    @Id
    @Column(name = "device_id")
    private String deviceId;
    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;
    @Column(name = "issued_by", nullable = false)
    private String issuedBy;
}
