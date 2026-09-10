package ee.woodstar.shop.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "site")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Site {
    @Id
    private UUID id;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String address;
    private Double lat;
    private Double lng;
    @Column(nullable = false)
    private boolean active;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
