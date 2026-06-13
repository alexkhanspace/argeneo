package net.argeneo.iam.repository;

import java.util.List;
import net.argeneo.iam.domain.PermissionGrant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

/** Attributions de permissions du tenant courant (filtrage tenant automatique). */
public interface PermissionGrantRepository extends JpaRepository<PermissionGrant, Long> {

    List<PermissionGrant> findByUserId(Long userId);

    List<PermissionGrant> findByUserIdAndEtablissementId(Long userId, Long etablissementId);

    @Transactional
    void deleteByUserIdAndEtablissementId(Long userId, Long etablissementId);
}
