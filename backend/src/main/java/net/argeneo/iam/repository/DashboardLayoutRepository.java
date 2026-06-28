package net.argeneo.iam.repository;

import java.util.Optional;
import net.argeneo.iam.domain.DashboardLayout;
import org.springframework.data.jpa.repository.JpaRepository;

/** Tableau de bord personnalisé, par principal (non scopé tenant). */
public interface DashboardLayoutRepository extends JpaRepository<DashboardLayout, Long> {

    Optional<DashboardLayout> findByPrincipalTypeAndPrincipalId(String principalType, Long principalId);
}
