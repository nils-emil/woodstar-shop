package ee.woodstar.shop.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "product")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Product {
    @Id
    private UUID id;
    @Column(name = "name_et", nullable = false)
    private String nameEt;
    @Column(name = "name_en", nullable = false)
    private String nameEn;
    @Column(name = "description_et")
    private String descriptionEt;
    @Column(name = "description_en")
    private String descriptionEn;
    @Column(name = "price_cents", nullable = false)
    private int priceCents;
    @Column(nullable = false)
    private boolean active;
    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public String nameFor(String locale) {
        return "en".equalsIgnoreCase(locale) ? nameEn : nameEt;
    }
}
