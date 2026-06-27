package net.argeneo.costing.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import net.argeneo.costing.domain.Unit;
import net.argeneo.costing.entity.RawMaterial;

/** DTOs des matières premières. */
public final class MaterialDtos {

    private MaterialDtos() {
    }

    public record CreateRawMaterialRequest(
            @NotBlank String name,
            @NotNull Unit referenceUnit,
            @NotNull @PositiveOrZero BigDecimal pricePerUnit,
            /** Famille de classement (optionnelle). */
            Long familleId,
            /** Sous-famille de classement (optionnelle, rattachée à familleId). */
            Long sousFamilleId) {
    }

    /** Mise à jour (renseigner le nouveau prix = enregistrer le dernier achat). */
    public record UpdateRawMaterialRequest(
            @NotBlank String name,
            @NotNull @PositiveOrZero BigDecimal pricePerUnit,
            Boolean active,
            /** Unité de référence modifiable (optionnel) : null = inchangée. */
            Unit referenceUnit,
            /** Famille de classement (optionnelle). */
            Long familleId,
            /** Sous-famille de classement (optionnelle, rattachée à familleId). */
            Long sousFamilleId) {
    }

    public record RawMaterialResponse(
            Long id,
            String name,
            Unit referenceUnit,
            BigDecimal pricePerUnit,
            Long familleId,
            String familleName,
            Long sousFamilleId,
            String sousFamilleName,
            boolean active) {

        public static RawMaterialResponse from(RawMaterial m, String familleName, String sousFamilleName) {
            return new RawMaterialResponse(m.getId(), m.getName(), m.getReferenceUnit(),
                    m.getPricePerUnit(), m.getFamilleId(), familleName,
                    m.getSousFamilleId(), sousFamilleName, m.isActive());
        }
    }
}
