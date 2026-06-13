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
            @NotNull @PositiveOrZero BigDecimal pricePerUnit) {
    }

    /** Mise à jour (renseigner le nouveau prix = enregistrer le dernier achat). */
    public record UpdateRawMaterialRequest(
            @NotBlank String name,
            @NotNull @PositiveOrZero BigDecimal pricePerUnit,
            Boolean active) {
    }

    public record RawMaterialResponse(
            Long id,
            String name,
            Unit referenceUnit,
            BigDecimal pricePerUnit,
            boolean active) {

        public static RawMaterialResponse from(RawMaterial m) {
            return new RawMaterialResponse(m.getId(), m.getName(), m.getReferenceUnit(),
                    m.getPricePerUnit(), m.isActive());
        }
    }
}
