package ee.woodstar.shop.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "admin_user")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AdminUser {
    @Id
    private UUID id;
    @Column(nullable = false, unique = true)
    private String username;
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
