package net.argeneo.iam.repository;

import java.util.Optional;
import net.argeneo.iam.domain.PlatformAdmin;
import org.springframework.data.jpa.repository.JpaRepository;

/** Super-Admins plateforme (table racine, non scopée). */
public interface PlatformAdminRepository extends JpaRepository<PlatformAdmin, Long> {

    Optional<PlatformAdmin> findByEmail(String email);
}
