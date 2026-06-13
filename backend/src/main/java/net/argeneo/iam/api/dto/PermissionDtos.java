package net.argeneo.iam.api.dto;

import java.util.List;
import net.argeneo.iam.domain.Permission;
import net.argeneo.iam.domain.PermissionPreset;

/** DTOs du catalogue de permissions et des presets. */
public final class PermissionDtos {

    private PermissionDtos() {
    }

    public record PermissionResponse(String code, String label, String category) {
        public static PermissionResponse from(Permission p) {
            return new PermissionResponse(p.getCode(), p.getLabel(), p.getCategory());
        }
    }

    public record PresetResponse(String code, String label, List<String> permissionCodes) {
        public static PresetResponse from(PermissionPreset p) {
            return new PresetResponse(p.getCode(), p.getLabel(),
                    p.getPermissionCodes().stream().sorted().toList());
        }
    }
}
