package net.argeneo.costing.api.dto;

import java.math.BigDecimal;
import java.util.List;
import net.argeneo.costing.domain.CostingSnapshots.ComponentType;
import net.argeneo.costing.domain.Unit;
import net.argeneo.costing.entity.ArticleType;

/** DTOs du coût de revient (PNET, HT) et de la marge vs prix de vente. */
public final class PnetDtos {

    private PnetDtos() {
    }

    public record PnetLine(
            String label,
            ComponentType type,
            long refId,
            BigDecimal quantity,
            Unit unit,
            BigDecimal lineCost) {
    }

    public record PnetResponse(
            Long articleId,
            String articleName,
            ArticleType type,
            // Coût de revient (HT)
            BigDecimal unitCost,
            Unit unit,
            BigDecimal batchCost,
            BigDecimal effectiveYield,
            Unit yieldUnit,
            List<PnetLine> lines,
            // Prix de vente & marge
            BigDecimal salePriceTtc,
            BigDecimal salePriceHt,
            BigDecimal vatRate,
            BigDecimal marginHt,
            BigDecimal markupRate,
            BigDecimal marginRate,
            BigDecimal coefficient) {
    }
}
