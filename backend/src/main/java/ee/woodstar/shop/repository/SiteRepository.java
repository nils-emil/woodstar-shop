package ee.woodstar.shop.repository;

import ee.woodstar.shop.domain.Site;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SiteRepository extends JpaRepository<Site, UUID> {
    List<Site> findByActiveTrueOrderByName();
    List<Site> findAllByOrderByName();
}
