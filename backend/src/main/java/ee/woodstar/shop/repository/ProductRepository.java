package ee.woodstar.shop.repository;

import ee.woodstar.shop.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {
    List<Product> findByActiveTrueOrderBySortOrderAscNameEtAsc();
    List<Product> findAllByOrderBySortOrderAscNameEtAsc();
}
