package ee.woodstar.shop.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "locker")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Locker {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;
    @Column(nullable = false)
    private String label;
    @Column(name = "shelly_device_id", nullable = false)
    private String shellyDeviceId;
    @Column(name = "relay_channel", nullable = false)
    private int relayChannel;
    @Column(name = "pulse_seconds", nullable = false)
    private int pulseSeconds;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LockerState state;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;
    @Column(name = "stocked_at")
    private Instant stockedAt;
    private String note;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
