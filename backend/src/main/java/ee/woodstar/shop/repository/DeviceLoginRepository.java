package ee.woodstar.shop.repository;

import ee.woodstar.shop.domain.DeviceLogin;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceLoginRepository extends JpaRepository<DeviceLogin, String> {
}
