package ee.woodstar.shop.repository;

import ee.woodstar.shop.domain.Locker;
import ee.woodstar.shop.domain.LockerState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LockerRepository extends JpaRepository<Locker, UUID> {

    /**
     * Allocates the oldest-stocked locker for a product at a site. Row-locked with SKIP LOCKED so
     * two concurrent buyers never receive the same locker; must run inside a transaction.
     */
    @Query(value = """
        SELECT * FROM locker
        WHERE site_id = :siteId AND product_id = :productId AND state = 'STOCKED'
        ORDER BY stocked_at ASC NULLS LAST
        LIMIT 1
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    Optional<Locker> lockOneStocked(@Param("siteId") UUID siteId, @Param("productId") UUID productId);

    List<Locker> findBySiteIdOrderByLabel(UUID siteId);
    List<Locker> findAllByOrderByLabel();

    long countBySiteIdAndProductIdAndState(UUID siteId, UUID productId, LockerState state);

    @Query("select l.site.id, l.product.id, count(l) from Locker l where l.state = 'STOCKED' group by l.site.id, l.product.id")
    List<Object[]> countStockedBySiteAndProduct();

    @Query("select l.site.id, l.state, count(l) from Locker l group by l.site.id, l.state")
    List<Object[]> countBySiteAndState();
}
