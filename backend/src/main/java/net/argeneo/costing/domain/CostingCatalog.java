package net.argeneo.costing.domain;

import net.argeneo.costing.domain.CostingSnapshots.RawMaterialSnapshot;
import net.argeneo.costing.domain.CostingSnapshots.RecipeSnapshot;

/**
 * Accès aux données dont le moteur a besoin. Implémenté côté infrastructure
 * (adaptateur JPA), de sorte que {@link CostEngine} reste un domaine pur.
 */
public interface CostingCatalog {

    /** @throws CostingException si la matière est introuvable. */
    RawMaterialSnapshot rawMaterial(long rawMaterialId);

    /** @throws CostingException si l'article n'a pas de recette. */
    RecipeSnapshot recipe(long articleId);
}
