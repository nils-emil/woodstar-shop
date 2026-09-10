package ee.woodstar.shop.service;

import ee.woodstar.shop.domain.*;
import ee.woodstar.shop.locker.LockerController;
import ee.woodstar.shop.repository.LockerRepository;
import ee.woodstar.shop.repository.ProductRepository;
import ee.woodstar.shop.repository.SiteRepository;
import ee.woodstar.shop.web.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final LockerRepository lockers;
    private final SiteRepository sites;
    private final ProductRepository products;
    private final LockerController lockerController;
    private final LockerEventService events;
    private final Clock clock;

    public record LockerInput(UUID siteId, String label, String shellyDeviceId, Integer relayChannel, Integer pulseSeconds, String note) {}

    @Transactional
    public Locker create(LockerInput in) {
        Site site = sites.findById(in.siteId()).orElseThrow(() -> ApiException.notFound("Site"));
        Locker l = Locker.builder()
            .id(UUID.randomUUID())
            .site(site)
            .state(LockerState.EMPTY)
            .updatedAt(clock.instant())
            .build();
        apply(l, in, site);
        return lockers.save(l);
    }

    @Transactional
    public Locker update(UUID id, LockerInput in) {
        Locker l = get(id);
        Site site = in.siteId() == null ? l.getSite() : sites.findById(in.siteId()).orElseThrow(() -> ApiException.notFound("Site"));
        apply(l, in, site);
        l.setUpdatedAt(clock.instant());
        return l;
    }

    private void apply(Locker l, LockerInput in, Site site) {
        l.setSite(site);
        if (in.label() != null) l.setLabel(in.label().trim());
        if (in.shellyDeviceId() != null) l.setShellyDeviceId(in.shellyDeviceId().trim());
        l.setRelayChannel(in.relayChannel() == null ? 0 : in.relayChannel());
        l.setPulseSeconds(in.pulseSeconds() == null ? 2 : in.pulseSeconds());
        l.setNote(in.note());
    }

    @Transactional
    public Locker stock(UUID lockerId, UUID productId, String actor) {
        Locker l = get(lockerId);
        if (l.getState() != LockerState.EMPTY) {
            throw ApiException.conflict("INVALID_STATE", "Only EMPTY lockers can be stocked (current: " + l.getState() + ")");
        }
        Product p = products.findById(productId).orElseThrow(() -> ApiException.notFound("Product"));
        Instant now = clock.instant();
        l.setProduct(p);
        l.setState(LockerState.STOCKED);
        l.setStockedAt(now);
        l.setUpdatedAt(now);
        events.record(l.getId(), null, LockerEventType.STOCKED, p.getNameEt() + " by " + actor);
        return l;
    }

    @Transactional
    public Locker empty(UUID lockerId, String actor) {
        Locker l = get(lockerId);
        if (l.getState() != LockerState.STOCKED) {
            throw ApiException.conflict("INVALID_STATE", "Only STOCKED lockers can be emptied (current: " + l.getState() + ")");
        }
        Instant now = clock.instant();
        l.setProduct(null);
        l.setStockedAt(null);
        l.setState(LockerState.EMPTY);
        l.setUpdatedAt(now);
        events.record(l.getId(), null, LockerEventType.EMPTIED, "by " + actor);
        return l;
    }

    @Transactional
    public Locker setOutOfOrder(UUID lockerId, boolean outOfOrder, String actor) {
        Locker l = get(lockerId);
        Instant now = clock.instant();
        if (outOfOrder) {
            if (l.getState() != LockerState.EMPTY && l.getState() != LockerState.STOCKED) {
                throw ApiException.conflict("INVALID_STATE", "Only EMPTY or STOCKED lockers can be taken out of order");
            }
            l.setState(LockerState.OUT_OF_ORDER);
            events.record(l.getId(), null, LockerEventType.STATE_CHANGED, "OUT_OF_ORDER by " + actor);
        } else {
            if (l.getState() != LockerState.OUT_OF_ORDER) {
                throw ApiException.conflict("INVALID_STATE", "Locker is not out of order");
            }
            l.setState(l.getProduct() != null ? LockerState.STOCKED : LockerState.EMPTY);
            events.record(l.getId(), null, LockerEventType.STATE_CHANGED, l.getState() + " (back in service) by " + actor);
        }
        l.setUpdatedAt(now);
        return l;
    }

    /** Manual open by an admin, in any state. Does not change locker or order state. */
    @Transactional
    public LockerController.OpenResult adminOpen(UUID lockerId, String actor) {
        Locker l = get(lockerId);
        events.record(l.getId(), null, LockerEventType.OPEN_REQUESTED, "admin:" + actor);
        LockerController.OpenResult r = lockerController.open(l.getShellyDeviceId(), l.getRelayChannel(), l.getPulseSeconds());
        events.record(l.getId(), null, r.ok() ? LockerEventType.OPEN_CONFIRMED : LockerEventType.OPEN_FAILED,
            "admin:" + actor + " — " + r.detail());
        if (!r.ok()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "DEVICE_UNREACHABLE", r.detail());
        }
        return r;
    }

    public Locker get(UUID id) {
        return lockers.findById(id).orElseThrow(() -> ApiException.notFound("Locker"));
    }
}
