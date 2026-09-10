package ee.woodstar.shop.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Order {
    @Id
    private UUID id;
    @Column(name = "order_number", nullable = false, unique = true)
    private String orderNumber;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "locker_id", nullable = false)
    private Locker locker;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;
    @Column(name = "product_name", nullable = false)
    private String productName;
    @Column(name = "price_cents", nullable = false)
    private int priceCents;
    @Column(nullable = false)
    private String email;
    private String phone;
    @Column(nullable = false)
    private String locale;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderState state;
    @Column(name = "pickup_token", nullable = false, unique = true)
    private String pickupToken;
    @Column(name = "payment_provider", nullable = false)
    private String paymentProvider;
    @Column(name = "payment_ref")
    private String paymentRef;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "paid_at")
    private Instant paidAt;
    @Column(name = "pickup_deadline")
    private Instant pickupDeadline;
    @Column(name = "picked_up_at")
    private Instant pickedUpAt;
    @Column(name = "first_open_at")
    private Instant firstOpenAt;
    @Column(name = "open_count", nullable = false)
    private int openCount;
}
