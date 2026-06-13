package net.argeneo.iam.api;

import java.util.List;
import net.argeneo.iam.api.dto.PermissionDtos.PermissionResponse;
import net.argeneo.iam.api.dto.PermissionDtos.PresetResponse;
import net.argeneo.iam.service.PermissionCatalogService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Catalogue des permissions atomiques et presets (pour l'UI d'attribution du patron). */
@RestController
@RequestMapping("/api")
@PreAuthorize("hasRole('PATRON')")
public class PermissionController {

    private final PermissionCatalogService catalogService;

    public PermissionController(PermissionCatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping("/permissions")
    public List<PermissionResponse> permissions() {
        return catalogService.listPermissions();
    }

    @GetMapping("/permission-presets")
    public List<PresetResponse> presets() {
        return catalogService.listPresets();
    }
}
