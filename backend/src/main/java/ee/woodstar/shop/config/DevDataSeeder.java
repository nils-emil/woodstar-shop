package ee.woodstar.shop.config;

import ee.woodstar.shop.domain.*;
import ee.woodstar.shop.repository.LockerRepository;
import ee.woodstar.shop.repository.ProductRepository;
import ee.woodstar.shop.repository.SiteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** Seeds the two demo sites with products and lockers when the database is empty (dev profile). */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "woodstar", name = "seed-demo-data", havingValue = "true")
public class DevDataSeeder {
    private final SiteRepository sites;
    private final ProductRepository products;
    private final LockerRepository lockers;
    private final Clock clock;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seed() {
        if (sites.count() > 0) return;
        Instant now = clock.instant();
        Site lillemae = sites.save(Site.builder().id(UUID.randomUUID()).name("Lillemäe")
            .address("Lillemäe, Paatna, 44411 Lääne-Viru maakond").active(true).createdAt(now).build());
        Site rakvere = sites.save(Site.builder().id(UUID.randomUUID()).name("Rakvere Põhjakeskus")
            .address("Põhjakeskus, Rakvere").active(true).createdAt(now).build());
        Product birch = products.save(Product.builder().id(UUID.randomUUID())
            .nameEt("Kuivad kaseklotsid 40 L").nameEn("Dry birch logs 40 L")
            .descriptionEt("Kuivatatud kask, niiskus alla 20 %").descriptionEn("Kiln-dried birch, moisture under 20 %")
            .priceCents(1200).active(true).sortOrder(1).createdAt(now).build());
        Product mixed = products.save(Product.builder().id(UUID.randomUUID())
            .nameEt("Segapuu 40 L").nameEn("Mixed hardwood 40 L")
            .descriptionEt("Lepp ja kask, hea grilliks").descriptionEn("Alder and birch, great for grilling")
            .priceCents(900).active(true).sortOrder(2).createdAt(now).build());

        // Lillemäe: A1–A3 birch, A4–A5 mixed, A6 empty. Rakvere: A1–A2 birch, A3 mixed, A4 empty.
        seedLockers(lillemae, new Product[] {birch, birch, birch, mixed, mixed, null}, 0, now);
        seedLockers(rakvere, new Product[] {birch, birch, mixed, null}, 100, now);
        log.info("Seeded demo sites '{}' and '{}' with 2 products and 10 lockers", lillemae.getName(), rakvere.getName());
    }

    private void seedLockers(Site site, Product[] stock, int deviceOffset, Instant now) {
        for (int i = 1; i <= stock.length; i++) {
            Product p = stock[i - 1];
            lockers.save(Locker.builder().id(UUID.randomUUID()).site(site).label("A" + i)
                .shellyDeviceId(String.format("shellyplus1-dev%04d", deviceOffset + i)).relayChannel(0).pulseSeconds(2)
                .state(p == null ? LockerState.EMPTY : LockerState.STOCKED)
                .product(p).stockedAt(p == null ? null : now.minus(Duration.ofMinutes(10L * i)))
                .updatedAt(now).build());
        }
    }
}
