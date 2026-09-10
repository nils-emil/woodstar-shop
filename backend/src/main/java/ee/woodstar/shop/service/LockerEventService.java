package ee.woodstar.shop.service;

import ee.woodstar.shop.domain.LockerEvent;
import ee.woodstar.shop.domain.LockerEventType;
import ee.woodstar.shop.repository.LockerEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LockerEventService {
    private final LockerEventRepository repo;
    private final Clock clock;

    public void record(UUID lockerId, UUID orderId, LockerEventType type, String detail) {
        repo.save(LockerEvent.builder()
            .id(UUID.randomUUID())
            .lockerId(lockerId)
            .orderId(orderId)
            .type(type)
            .detail(detail)
            .createdAt(clock.instant())
            .build());
    }
}
