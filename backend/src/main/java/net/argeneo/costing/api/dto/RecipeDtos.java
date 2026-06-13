package net.argeneo.costing.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.util.List;
import net.argeneo.costing.domain.CostingSnapshots.ComponentType;
import net.argeneo.costing.domain.Unit;

/** DTOs des recettes. */
public final class RecipeDtos {

    private RecipeDtos() {
    }

    public record ComponentRequest(
            @NotNull ComponentType type,
            Long rawMaterialId,
            Long subArticleId,
            @NotNull @Positive BigDecimal quantity,
            @NotNull Unit unit) {
    }

    public record UpsertRecipeRequest(
            @NotNull @Positive BigDecimal yieldQuantity,
            @NotNull Unit yieldUnit,
            @NotNull @PositiveOrZero BigDecimal lossRate,
            String method,
            Integer durationMinutes,
            @Valid List<ComponentRequest> components) {
    }

    public record ComponentResponse(
            Long id,
            ComponentType type,
            Long rawMaterialId,
            Long subArticleId,
            String label,
            BigDecimal quantity,
            Unit unit) {
    }

    public record RecipeResponse(
            Long articleId,
            BigDecimal yieldQuantity,
            Unit yieldUnit,
            BigDecimal lossRate,
            String method,
            Integer durationMinutes,
            List<ComponentResponse> components) {
    }
}
