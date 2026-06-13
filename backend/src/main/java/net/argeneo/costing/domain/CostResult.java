package net.argeneo.costing.domain;

import java.math.BigDecimal;
import java.util.List;
import net.argeneo.costing.domain.CostingSnapshots.ComponentType;

/** Résultat du calcul de coût d'un article fabriqué, avec le détail par composant. */
public record CostResult(
        long articleId,
        BigDecimal batchCost,
        BigDecimal effectiveYield,
        Unit yieldUnit,
        BigDecimal unitCost,
        List<CostLine> lines) {

    /** Une ligne du détail de coût (un composant). */
    public record CostLine(
            String label,
            ComponentType type,
            long refId,
            BigDecimal quantity,
            Unit unit,
            BigDecimal lineCost) {
    }
}
