package net.argeneo.bootstrap;

import net.argeneo.config.ArgeneoProperties;
import net.argeneo.config.ArgeneoProperties.SuperAdmin;
import net.argeneo.iam.domain.PlatformAdmin;
import net.argeneo.iam.repository.PlatformAdminRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Amorce un Super-Admin au démarrage s'il n'existe pas (DEV / premier lancement). */
@Component
public class SuperAdminInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminInitializer.class);

    private final ArgeneoProperties properties;
    private final PlatformAdminRepository adminRepository;
    private final PasswordEncoder passwordEncoder;

    public SuperAdminInitializer(ArgeneoProperties properties,
                                 PlatformAdminRepository adminRepository,
                                 PasswordEncoder passwordEncoder) {
        this.properties = properties;
        this.adminRepository = adminRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        SuperAdmin config = properties.bootstrap().superAdmin();
        if (config == null || !config.enabled()) {
            return;
        }
        String email = config.email().trim().toLowerCase();
        if (adminRepository.findByEmail(email).isPresent()) {
            return;
        }
        PlatformAdmin admin = new PlatformAdmin();
        admin.setEmail(email);
        admin.setPasswordHash(passwordEncoder.encode(config.password()));
        admin.setFullName(config.fullName());
        adminRepository.save(admin);
        log.info("Super-Admin amorcé : {}", email);
    }
}
