package net.argeneo.billing.repository;

import java.util.Optional;
import net.argeneo.billing.domain.BillingProfile;
import org.springframework.data.jpa.repository.JpaRepository;

/** Profil émetteur, rattaché à un établissement. */
public interface BillingProfileRepository extends JpaRepository<BillingProfile, Long> {

    Optional<BillingProfile> findByEtablissementId(Long etablissementId);
}
