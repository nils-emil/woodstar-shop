package ee.woodstar.shop.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "locker_event")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LockerEvent {
    @Id
    private UUID id;
    @Column(name = "locker_id", nullable = false)
    private UUID lockerId;
    @Column(name = "order_id")
    private UUID orderId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LockerEventType type;
    private String detail;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
