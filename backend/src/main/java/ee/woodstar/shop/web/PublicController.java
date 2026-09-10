package ee.woodstar.shop.web;

import ee.woodstar.shop.domain.Order;
import ee.woodstar.shop.domain.Product;
import ee.woodstar.shop.domain.Site;
import ee.woodstar.shop.repository.LockerRepository;
import ee.woodstar.shop.repository.OrderRepository;
import ee.woodstar.shop.repository.ProductRepository;
import ee.woodstar.shop.repository.SiteRepository;
import ee.woodstar.shop.service.OrderService;
import ee.woodstar.shop.web.Dtos.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PublicController {

    private final SiteRepository sites;
    private final ProductRepository products;
    private final LockerRepository lockers;
    private final OrderRepository orders;
    private final OrderService orderService;

    @GetMapping("/sites")
    @Transactional(readOnly = true)
    public List<SiteView> sites() {
        List<Product> activeProducts = products.findByActiveTrueOrderBySortOrderAscNameEtAsc();
        Map<UUID, Map<UUID, Long>> stock = new HashMap<>();
        for (Object[] row : lockers.countStockedBySiteAndProduct()) {
            stock.computeIfAbsent((UUID) row[0], k -> new HashMap<>()).put((UUID) row[1], (Long) row[2]);
        }
        return sites.findByActiveTrueOrderByName().stream().map(site -> {
            Map<UUID, Long> perProduct = stock.getOrDefault(site.getId(), Map.of());
            List<ProductAvailability> pa = activeProducts.stream()
                .map(p -> new ProductAvailability(p.getId(), p.getNameEt(), p.getNameEn(), p.getDescriptionEt(),
                    p.getDescriptionEn(), p.getPriceCents(), perProduct.getOrDefault(p.getId(), 0L)))
                .toList();
            return new SiteView(site.getId(), site.getName(), site.getAddress(), site.getLat(), site.getLng(), pa);
        }).toList();
    }

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateOrderResponse createOrder(@Valid @RequestBody CreateOrderRequest req, HttpServletRequest http) {
        OrderService.Checkout c = orderService.create(req.siteId(), req.productId(), req.email(), req.phone(), req.locale(), http.getRemoteAddr());
        return new CreateOrderResponse(c.orderId(), c.checkoutUrl());
    }

    @GetMapping("/orders/{id}")
    @Transactional(readOnly = true)
    public OrderView order(@PathVariable UUID id) {
        Order o = orders.findById(id).orElseThrow(() -> ApiException.notFound("Order"));
        return OrderView.of(o);
    }
}
