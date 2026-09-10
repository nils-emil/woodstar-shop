package ee.woodstar.shop.web;

import ee.woodstar.shop.domain.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class Dtos {
    private Dtos() {}

    // ---- public
    public record ProductAvailability(UUID id, String nameEt, String nameEn, String descriptionEt, String descriptionEn,
                                      int priceCents, long available) {}
    public record SiteView(UUID id, String name, String address, Double lat, Double lng, List<ProductAvailability> products) {}

    public record CreateOrderRequest(@NotNull UUID siteId, @NotNull UUID productId,
                                     @NotBlank @Email String email, String phone, String locale) {}
    public record CreateOrderResponse(UUID orderId, String checkoutUrl) {}

    public record OrderView(UUID id, String orderNumber, OrderState state, String siteName, String siteAddress,
                            String lockerLabel, String productName, int priceCents, String pickupToken, Instant pickupDeadline) {
        public static OrderView of(Order o) {
            boolean showToken = o.getState() == OrderState.PAID || o.getState() == OrderState.PICKED_UP;
            return new OrderView(o.getId(), o.getOrderNumber(), o.getState(), o.getSite().getName(), o.getSite().getAddress(),
                o.getLocker().getLabel(), o.getProductName(), o.getPriceCents(),
                showToken ? o.getPickupToken() : null, o.getPickupDeadline());
        }
    }

    public record PickupView(String orderNumber, OrderState state, String siteName, String siteAddress, String lockerLabel,
                             String productName, Instant pickupDeadline, boolean canOpen, String cannotOpenReason,
                             int opensRemaining, boolean deviceOnline) {}
    public record OpenResponse(boolean ok, int opensRemaining) {}

    // ---- admin
    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
    public record MeResponse(String username) {}

    public record SiteInput(@NotBlank String name, @NotBlank String address, Double lat, Double lng, Boolean active) {}
    public record SiteAdmin(UUID id, String name, String address, Double lat, Double lng, boolean active, Instant createdAt) {
        public static SiteAdmin of(Site s) {
            return new SiteAdmin(s.getId(), s.getName(), s.getAddress(), s.getLat(), s.getLng(), s.isActive(), s.getCreatedAt());
        }
    }

    public record ProductInput(@NotBlank String nameEt, @NotBlank String nameEn, String descriptionEt, String descriptionEn,
                               @NotNull @Min(0) Integer priceCents, Boolean active, Integer sortOrder) {}
    public record ProductAdmin(UUID id, String nameEt, String nameEn, String descriptionEt, String descriptionEn,
                               int priceCents, boolean active, int sortOrder) {
        public static ProductAdmin of(Product p) {
            return new ProductAdmin(p.getId(), p.getNameEt(), p.getNameEn(), p.getDescriptionEt(), p.getDescriptionEn(),
                p.getPriceCents(), p.isActive(), p.getSortOrder());
        }
    }

    public record LockerInputDto(UUID siteId, @NotBlank String label, @NotBlank String shellyDeviceId,
                                 Integer relayChannel, Integer pulseSeconds, String note) {}
    public record LockerAdmin(UUID id, UUID siteId, String siteName, String label, String shellyDeviceId, int relayChannel,
                              int pulseSeconds, LockerState state, UUID productId, String productName, Instant stockedAt,
                              String note, boolean online, UUID currentOrderId, String currentOrderNumber) {}
    public record StockRequest(@NotNull UUID productId) {}
    public record OutOfOrderRequest(boolean outOfOrder) {}
    public record EventView(UUID id, UUID orderId, LockerEventType type, String detail, Instant createdAt) {
        public static EventView of(LockerEvent e) {
            return new EventView(e.getId(), e.getOrderId(), e.getType(), e.getDetail(), e.getCreatedAt());
        }
    }

    public record OrderAdmin(UUID id, String orderNumber, OrderState state, String siteName, String lockerLabel,
                             String productName, int priceCents, String email, String phone, Instant createdAt,
                             Instant paidAt, Instant pickupDeadline, Instant pickedUpAt, int openCount, String pickupToken) {
        public static OrderAdmin of(Order o) {
            return new OrderAdmin(o.getId(), o.getOrderNumber(), o.getState(), o.getSite().getName(), o.getLocker().getLabel(),
                o.getProductName(), o.getPriceCents(), o.getEmail(), o.getPhone(), o.getCreatedAt(), o.getPaidAt(),
                o.getPickupDeadline(), o.getPickedUpAt(), o.getOpenCount(), o.getPickupToken());
        }
    }
    public record OrderAdminDetail(OrderAdmin order, List<EventView> events) {}

    public record SiteStats(UUID siteId, String siteName, long stocked, long reserved, long sold, long empty,
                            long outOfOrder, long offlineDevices) {}
    public record Dashboard(List<SiteStats> sites, long ordersToday, long revenueTodayCents, long paidAwaitingPickup, long overduePickups) {}

    public record DeviceLocker(UUID id, String label, String siteName) {}
    public record DeviceView(String deviceId, boolean online, List<DeviceLocker> lockers) {}
}
