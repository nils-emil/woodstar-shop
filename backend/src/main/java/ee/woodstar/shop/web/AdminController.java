package ee.woodstar.shop.web;

import ee.woodstar.shop.domain.*;
import ee.woodstar.shop.locker.LockerController;
import ee.woodstar.shop.repository.*;
import ee.woodstar.shop.service.DeviceService;
import ee.woodstar.shop.service.InventoryService;
import ee.woodstar.shop.service.OrderService;
import ee.woodstar.shop.web.Dtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private static final ZoneId TALLINN = ZoneId.of("Europe/Tallinn");

    private final SiteRepository sites;
    private final ProductRepository products;
    private final LockerRepository lockers;
    private final OrderRepository orders;
    private final LockerEventRepository events;
    private final DeviceLoginRepository deviceLogins;
    private final DeviceService deviceService;
    private final InventoryService inventory;
    private final OrderService orderService;
    private final LockerController lockerController;
    private final Clock clock;

    // ---- dashboard
    @GetMapping("/dashboard")
    @Transactional(readOnly = true)
    public Dashboard dashboard() {
        Map<UUID, Map<LockerState, Long>> byState = new HashMap<>();
        for (Object[] row : lockers.countBySiteAndState()) {
            byState.computeIfAbsent((UUID) row[0], k -> new EnumMap<>(LockerState.class)).put((LockerState) row[1], (Long) row[2]);
        }
        Map<UUID, Long> offline = lockers.findAll().stream()
            .filter(l -> !lockerController.isOnline(l.getShellyDeviceId()))
            .collect(Collectors.groupingBy(l -> l.getSite().getId(), Collectors.counting()));
        List<SiteStats> stats = sites.findAllByOrderByName().stream().map(s -> {
            Map<LockerState, Long> m = byState.getOrDefault(s.getId(), Map.of());
            return new SiteStats(s.getId(), s.getName(), m.getOrDefault(LockerState.STOCKED, 0L),
                m.getOrDefault(LockerState.RESERVED, 0L), m.getOrDefault(LockerState.SOLD, 0L),
                m.getOrDefault(LockerState.EMPTY, 0L), m.getOrDefault(LockerState.OUT_OF_ORDER, 0L),
                offline.getOrDefault(s.getId(), 0L));
        }).toList();
        Instant now = clock.instant();
        Instant startOfDay = LocalDate.now(clock.withZone(TALLINN)).atStartOfDay(TALLINN).toInstant();
        return new Dashboard(stats, orders.countByCreatedAtGreaterThanEqual(startOfDay), orders.revenueSince(startOfDay),
            orders.countByState(OrderState.PAID), orders.countByStateAndPickupDeadlineBefore(OrderState.PAID, now));
    }

    // ---- sites
    @GetMapping("/sites")
    public List<SiteAdmin> listSites() {
        return sites.findAllByOrderByName().stream().map(SiteAdmin::of).toList();
    }

    @PostMapping("/sites")
    @ResponseStatus(HttpStatus.CREATED)
    public SiteAdmin createSite(@Valid @RequestBody SiteInput in) {
        Site s = Site.builder().id(UUID.randomUUID()).createdAt(clock.instant()).build();
        applySite(s, in);
        return SiteAdmin.of(sites.save(s));
    }

    @PutMapping("/sites/{id}")
    @Transactional
    public SiteAdmin updateSite(@PathVariable UUID id, @Valid @RequestBody SiteInput in) {
        Site s = sites.findById(id).orElseThrow(() -> ApiException.notFound("Site"));
        applySite(s, in);
        return SiteAdmin.of(s);
    }

    private void applySite(Site s, SiteInput in) {
        s.setName(in.name().trim());
        s.setAddress(in.address().trim());
        s.setLat(in.lat());
        s.setLng(in.lng());
        s.setActive(in.active() == null || in.active());
    }

    // ---- products
    @GetMapping("/products")
    public List<ProductAdmin> listProducts() {
        return products.findAllByOrderBySortOrderAscNameEtAsc().stream().map(ProductAdmin::of).toList();
    }

    @PostMapping("/products")
    @ResponseStatus(HttpStatus.CREATED)
    public ProductAdmin createProduct(@Valid @RequestBody ProductInput in) {
        Product p = Product.builder().id(UUID.randomUUID()).createdAt(clock.instant()).build();
        applyProduct(p, in);
        return ProductAdmin.of(products.save(p));
    }

    @PutMapping("/products/{id}")
    @Transactional
    public ProductAdmin updateProduct(@PathVariable UUID id, @Valid @RequestBody ProductInput in) {
        Product p = products.findById(id).orElseThrow(() -> ApiException.notFound("Product"));
        applyProduct(p, in);
        return ProductAdmin.of(p);
    }

    private void applyProduct(Product p, ProductInput in) {
        p.setNameEt(in.nameEt().trim());
        p.setNameEn(in.nameEn().trim());
        p.setDescriptionEt(in.descriptionEt());
        p.setDescriptionEn(in.descriptionEn());
        p.setPriceCents(in.priceCents());
        p.setActive(in.active() == null || in.active());
        p.setSortOrder(in.sortOrder() == null ? 0 : in.sortOrder());
    }

    // ---- lockers
    @GetMapping("/lockers")
    @Transactional(readOnly = true)
    public List<LockerAdmin> listLockers(@RequestParam(required = false) UUID siteId) {
        List<Locker> list = siteId == null ? lockers.findAllByOrderByLabel() : lockers.findBySiteIdOrderByLabel(siteId);
        return list.stream().map(this::toAdmin).toList();
    }

    @PostMapping("/lockers")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public LockerAdmin createLocker(@Valid @RequestBody LockerInputDto in) {
        if (in.siteId() == null) throw ApiException.badRequest("VALIDATION", "siteId is required");
        return toAdmin(inventory.create(toInput(in)));
    }

    @PutMapping("/lockers/{id}")
    @Transactional
    public LockerAdmin updateLocker(@PathVariable UUID id, @Valid @RequestBody LockerInputDto in) {
        return toAdmin(inventory.update(id, toInput(in)));
    }

    @PostMapping("/lockers/{id}/stock")
    @Transactional
    public LockerAdmin stock(@PathVariable UUID id, @Valid @RequestBody StockRequest req, Authentication auth) {
        return toAdmin(inventory.stock(id, req.productId(), auth.getName()));
    }

    @PostMapping("/lockers/{id}/empty")
    @Transactional
    public LockerAdmin empty(@PathVariable UUID id, Authentication auth) {
        return toAdmin(inventory.empty(id, auth.getName()));
    }

    @PostMapping("/lockers/{id}/out-of-order")
    @Transactional
    public LockerAdmin outOfOrder(@PathVariable UUID id, @RequestBody OutOfOrderRequest req, Authentication auth) {
        return toAdmin(inventory.setOutOfOrder(id, req.outOfOrder(), auth.getName()));
    }

    @PostMapping("/lockers/{id}/open")
    public Map<String, Object> openLocker(@PathVariable UUID id, Authentication auth) {
        LockerController.OpenResult r = inventory.adminOpen(id, auth.getName());
        return Map.of("ok", r.ok(), "detail", r.detail());
    }

    @GetMapping("/lockers/{id}/events")
    public List<EventView> lockerEvents(@PathVariable UUID id) {
        inventory.get(id);
        return events.findTop100ByLockerIdOrderByCreatedAtDesc(id).stream().map(EventView::of).toList();
    }

    private InventoryService.LockerInput toInput(LockerInputDto in) {
        return new InventoryService.LockerInput(in.siteId(), in.label(), in.shellyDeviceId(), in.relayChannel(), in.pulseSeconds(), in.note());
    }

    private LockerAdmin toAdmin(Locker l) {
        Order current = (l.getState() == LockerState.RESERVED || l.getState() == LockerState.SOLD)
            ? orders.findFirstByLockerIdAndStateInOrderByCreatedAtDesc(l.getId(), List.of(OrderState.PENDING_PAYMENT, OrderState.PAID)).orElse(null)
            : null;
        Product p = l.getProduct();
        return new LockerAdmin(l.getId(), l.getSite().getId(), l.getSite().getName(), l.getLabel(), l.getShellyDeviceId(),
            l.getRelayChannel(), l.getPulseSeconds(), l.getState(), p == null ? null : p.getId(), p == null ? null : p.getNameEt(),
            l.getStockedAt(), l.getNote(), lockerController.isOnline(l.getShellyDeviceId()),
            current == null ? null : current.getId(), current == null ? null : current.getOrderNumber());
    }

    // ---- orders
    @GetMapping("/orders")
    @Transactional(readOnly = true)
    public List<OrderAdmin> listOrders(@RequestParam(required = false) OrderState state,
                                       @RequestParam(required = false) UUID siteId,
                                       @RequestParam(required = false) String q) {
        String query = q == null ? "" : q.trim();
        return orders.search(state, siteId, query, PageRequest.of(0, 200)).stream().map(OrderAdmin::of).toList();
    }

    @GetMapping("/orders/{id}")
    @Transactional(readOnly = true)
    public OrderAdminDetail order(@PathVariable UUID id) {
        Order o = orders.findById(id).orElseThrow(() -> ApiException.notFound("Order"));
        return new OrderAdminDetail(OrderAdmin.of(o), events.findByOrderIdOrderByCreatedAtAsc(id).stream().map(EventView::of).toList());
    }

    @PostMapping("/orders/{id}/cancel")
    @Transactional
    public OrderAdmin cancel(@PathVariable UUID id, Authentication auth) {
        return OrderAdmin.of(orderService.cancel(id, auth.getName()));
    }

    @PostMapping("/orders/{id}/resend-email")
    public Map<String, String> resend(@PathVariable UUID id) {
        orderService.resendEmail(id);
        return Map.of("status", "ok");
    }

    // ---- devices
    /** Every device a locker points at, plus devices that have a broker login but no locker yet. */
    @GetMapping("/devices")
    @Transactional(readOnly = true)
    public List<DeviceView> devices() {
        Map<String, List<Locker>> byDevice = lockers.findAllByOrderByLabel().stream()
            .collect(Collectors.groupingBy(Locker::getShellyDeviceId, TreeMap::new, Collectors.toList()));
        Map<String, Instant> issued = deviceLogins.findAll().stream()
            .collect(Collectors.toMap(DeviceLogin::getDeviceId, DeviceLogin::getIssuedAt));
        issued.keySet().forEach(id -> byDevice.putIfAbsent(id, List.of()));
        return byDevice.entrySet().stream().map(e -> new DeviceView(e.getKey(), lockerController.isOnline(e.getKey()),
            e.getValue().stream().map(l -> new DeviceLocker(l.getId(), l.getLabel(), l.getSite().getName())).toList(),
            issued.get(e.getKey()))).toList();
    }

    /** Creates the device's broker login or replaces its password. The response is the only place the password appears. */
    @PostMapping("/devices/login")
    public DeviceService.IssuedLogin issueDeviceLogin(@Valid @RequestBody DeviceIdRequest req, Authentication auth) {
        return deviceService.issueLogin(req.deviceId(), auth.getName());
    }

    @DeleteMapping("/devices/{deviceId}/login")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeDeviceLogin(@PathVariable String deviceId, Authentication auth) {
        deviceService.revokeLogin(deviceId, auth.getName());
    }
}
