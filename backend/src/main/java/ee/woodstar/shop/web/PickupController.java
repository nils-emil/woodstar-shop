package ee.woodstar.shop.web;

import ee.woodstar.shop.domain.Order;
import ee.woodstar.shop.locker.LockerController;
import ee.woodstar.shop.service.PickupService;
import ee.woodstar.shop.web.Dtos.OpenResponse;
import ee.woodstar.shop.web.Dtos.PickupView;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/pickup")
@RequiredArgsConstructor
public class PickupController {

    private final PickupService pickupService;
    private final LockerController lockerController;

    @GetMapping("/{token}")
    @Transactional(readOnly = true)
    public PickupView view(@PathVariable String token) {
        Order o = pickupService.findByToken(token);
        String reason = pickupService.cannotOpenReason(o).orElse(null);
        return new PickupView(o.getOrderNumber(), o.getState(), o.getSite().getName(), o.getSite().getAddress(),
            o.getLocker().getLabel(), o.getProductName(), o.getPickupDeadline(), reason == null, reason,
            pickupService.opensRemaining(o), lockerController.isOnline(o.getLocker().getShellyDeviceId()));
    }

    @PostMapping("/{token}/open")
    public OpenResponse open(@PathVariable String token) {
        Order o = pickupService.open(token);
        return new OpenResponse(true, pickupService.opensRemaining(o));
    }
}
