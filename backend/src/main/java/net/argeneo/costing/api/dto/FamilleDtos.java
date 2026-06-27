package net.argeneo.costing.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import net.argeneo.costing.entity.Famille;

/** DTOs du référentiel des familles / sous-familles. */
public final class FamilleDtos {

    private FamilleDtos() {
    }

    /**
     * Création d'une famille (parentId null) ou d'une sous-famille (parentId renseigné).
     * Le scope est porté par l'URL (?scope=ARTICLE|RAW_MATERIAL).
     */
    public record CreateFamilleRequest(
            @NotBlank @Size(max = 120) String name,
            /** Famille parente : null pour une famille, son id pour une sous-famille. */
            Long parentId) {
    }

    public record UpdateFamilleRequest(
            @NotBlank @Size(max = 120) String name) {
    }

    /** Famille avec ses sous-familles imbriquées (arborescence à deux niveaux). */
    public record FamilleResponse(
            Long id,
            String name,
            Integer position,
            List<FamilleResponse> children) {

        public static FamilleResponse leaf(Famille f) {
            return new FamilleResponse(f.getId(), f.getName(), f.getPosition(), List.of());
        }

        public static FamilleResponse withChildren(Famille f, List<FamilleResponse> children) {
            return new FamilleResponse(f.getId(), f.getName(), f.getPosition(), children);
        }
    }
}
