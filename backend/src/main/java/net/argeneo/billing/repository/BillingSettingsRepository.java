package net.argeneo.billing.repository;

import java.util.Optional;
import net.argeneo.billing.domain.BillingSettings;
import org.springframework.data.jpa.repository.JpaRepository;

/** Paramètres de facturation, rattachés à un établissement. */
public interface BillingSettingsRepository extends JpaRepository<BillingSettings, Long> {

    Optional<BillingSettings> findByEtablissementId(Long etablissementId);
}
