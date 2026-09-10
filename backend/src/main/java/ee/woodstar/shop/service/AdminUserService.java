package ee.woodstar.shop.service;

import ee.woodstar.shop.config.WoodstarProperties;
import ee.woodstar.shop.domain.AdminUser;
import ee.woodstar.shop.repository.AdminUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminUserService {
    private final AdminUserRepository repo;
    private final PasswordEncoder encoder;
    private final WoodstarProperties props;
    private final Clock clock;

    @EventListener(ApplicationReadyEvent.class)
    public void seedInitialAdmin() {
        if (repo.count() > 0) return;
        String username = props.getAdmin().getUsername();
        String password = props.getAdmin().getPassword();
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            log.warn("No admin users exist and ADMIN_USERNAME/ADMIN_PASSWORD are not set — admin login is impossible");
            return;
        }
        repo.save(AdminUser.builder()
            .id(UUID.randomUUID())
            .username(username)
            .passwordHash(encoder.encode(password))
            .createdAt(clock.instant())
            .build());
        log.info("Seeded initial admin user '{}'", username);
    }
}
