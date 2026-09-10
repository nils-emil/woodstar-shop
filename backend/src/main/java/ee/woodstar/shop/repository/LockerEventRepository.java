package ee.woodstar.shop.repository;

import ee.woodstar.shop.domain.LockerEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LockerEventRepository extends JpaRepository<LockerEvent, UUID> {
    List<LockerEvent> findTop100ByLockerIdOrderByCreatedAtDesc(UUID lockerId);
    List<LockerEvent> findByOrderIdOrderByCreatedAtAsc(UUID orderId);
}
