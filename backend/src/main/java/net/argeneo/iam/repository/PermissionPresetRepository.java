package net.argeneo.iam.repository;

import net.argeneo.iam.domain.PermissionPreset;
import org.springframework.data.jpa.repository.JpaRepository;

/** Presets UI (référence globale). */
public interface PermissionPresetRepository extends JpaRepository<PermissionPreset, String> {
}
