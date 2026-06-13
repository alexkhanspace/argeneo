package net.argeneo.costing.domain;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import net.argeneo.costing.domain.CostResult.CostLine;
import net.argeneo.costing.domain.CostingSnapshots.ComponentSnapshot;
import net.argeneo.costing.domain.CostingSnapshots.ComponentType;
import net.argeneo.costing.domain.CostingSnapshots.RawMaterialSnapshot;
import net.argeneo.costing.domain.CostingSnapshots.RecipeSnapshot;

/**
 * Moteur de calcul du coût de revient (PNET). Domaine pur, sans dépendance
 * JPA/Spring, entièrement testable unitairement.
 *
 * <p>Coût d'un article fabriqué = somme des coûts des composants (matières +
 * sous-recettes), ajustée du rendement et du taux de perte. Les sous-recettes
 * sont résolues récursivement avec détection de cycle et mémoïsation.</p>
 */
public class CostEngine {

    private static final MathContext MC = new MathContext(16, RoundingMode.HALF_UP);
    private static final BigDecimal ONE = BigDecimal.ONE;

    /** Coût unitaire (par unité de rendement) de l'article, avec le détail. */
    public CostResult computeUnitCost(long articleId, CostingCatalog catalog) {
        return compute(articleId, catalog, new LinkedHashSet<>(), new HashMap<>());
    }

    private CostResult compute(long articleId,
                               CostingCatalog catalog,
                               Set<Long> path,
                               Map<Long, CostResult> memo) {
        CostResult cached = memo.get(articleId);
        if (cached != null) {
            return cached;
        }
        if (!path.add(articleId)) {
            throw new CostingCycleException(new ArrayList<>(path), articleId);
        }

        RecipeSnapshot recipe = catalog.recipe(articleId);
        BigDecimal batchCost = BigDecimal.ZERO;
        List<CostLine> lines = new ArrayList<>();

        for (ComponentSnapshot component : recipe.components()) {
            CostLine line = costOf(component, catalog, path, memo);
            lines.add(line);
            batchCost = batchCost.add(line.lineCost(), MC);
        }

        BigDecimal lossRate = recipe.lossRate() == null ? BigDecimal.ZERO : recipe.lossRate();
        BigDecimal effectiveYield = recipe.yieldQuantity().multiply(ONE.subtract(lossRate), MC);
        BigDecimal unitCost = effectiveYield.signum() == 0
                ? BigDecimal.ZERO
                : batchCost.divide(effectiveYield, MC);

        CostResult result = new CostResult(
                articleId, batchCost, effectiveYield, recipe.yieldUnit(), unitCost, lines);

        path.remove(articleId);
        memo.put(articleId, result);
        return result;
    }

    private CostLine costOf(ComponentSnapshot component,
                            CostingCatalog catalog,
                            Set<Long> path,
                            Map<Long, CostResult> memo) {
        if (component.type() == ComponentType.RAW) {
            RawMaterialSnapshot material = catalog.rawMaterial(component.refId());
            BigDecimal qtyInRef = component.unit().convert(component.quantity(), material.referenceUnit(), MC);
            BigDecimal cost = qtyInRef.multiply(material.pricePerReferenceUnit(), MC);
            return new CostLine(material.name(), ComponentType.RAW, material.id(),
                    component.quantity(), component.unit(), cost);
        }

        // Sous-recette : coût unitaire (par unité de rendement) calculé récursivement.
        CostResult sub = compute(component.refId(), catalog, path, memo);
        BigDecimal qtyInYieldUnit = component.unit().convert(component.quantity(), sub.yieldUnit(), MC);
        BigDecimal cost = qtyInYieldUnit.multiply(sub.unitCost(), MC);
        return new CostLine("Sous-recette #" + component.refId(), ComponentType.SUBRECIPE,
                component.refId(), component.quantity(), component.unit(), cost);
    }
}
