package net.argeneo.iam.service;

import java.util.List;
import net.argeneo.iam.api.dto.PermissionDtos.PermissionResponse;
import net.argeneo.iam.api.dto.PermissionDtos.PresetResponse;
import net.argeneo.iam.repository.PermissionPresetRepository;
import net.argeneo.iam.repository.PermissionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Catalogue des permissions atomiques et presets (référence, lecture seule). */
@Service
public class PermissionCatalogService {

    private final PermissionRepository permissionRepository;
    private final PermissionPresetRepository presetRepository;

    public PermissionCatalogService(PermissionRepository permissionRepository,
                                    PermissionPresetRepository presetRepository) {
        this.permissionRepository = permissionRepository;
        this.presetRepository = presetRepository;
    }

    @Transactional(readOnly = true)
    public List<PermissionResponse> listPermissions() {
        return permissionRepository.findAllByOrderByCategoryAscCodeAsc()
                .stream().map(PermissionResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<PresetResponse> listPresets() {
        return presetRepository.findAll().stream().map(PresetResponse::from).toList();
    }
}
