package ee.woodstar.shop.repository;

import ee.woodstar.shop.domain.Order;
import ee.woodstar.shop.domain.OrderState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    Optional<Order> findByPickupToken(String token);
    Optional<Order> findByPaymentRef(String paymentRef);
    List<Order> findByStateAndCreatedAtBefore(OrderState state, Instant before);
    Optional<Order> findFirstByLockerIdAndStateInOrderByCreatedAtDesc(UUID lockerId, List<OrderState> states);

    @Query(value = "select nextval('order_number_seq')", nativeQuery = true)
    long nextOrderNumber();

    @Query("""
        select o from Order o
        where (:state is null or o.state = :state)
          and (:siteId is null or o.site.id = :siteId)
          and (lower(o.email) like lower(concat('%', :q, '%')) or lower(o.orderNumber) like lower(concat('%', :q, '%')))
        order by o.createdAt desc
        """)
    /** {@code q} must not be null: Postgres cannot type a null text parameter here. Pass "" to match all. */
    List<Order> search(@Param("state") OrderState state, @Param("siteId") UUID siteId, @Param("q") String q,
                       org.springframework.data.domain.Pageable pageable);

    long countByCreatedAtGreaterThanEqual(Instant since);

    @Query("select coalesce(sum(o.priceCents), 0) from Order o where o.paidAt >= :since and o.state in ('PAID','PICKED_UP')")
    long revenueSince(@Param("since") Instant since);

    long countByState(OrderState state);
    long countByStateAndPickupDeadlineBefore(OrderState state, Instant before);
}
