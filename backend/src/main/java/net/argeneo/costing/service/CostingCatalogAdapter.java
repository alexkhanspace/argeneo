package net.argeneo.costing.service;

import net.argeneo.costing.domain.CostingCatalog;
import net.argeneo.costing.domain.CostingException;
import net.argeneo.costing.domain.CostingSnapshots.ComponentSnapshot;
import net.argeneo.costing.domain.CostingSnapshots.ComponentType;
import net.argeneo.costing.domain.CostingSnapshots.RawMaterialSnapshot;
import net.argeneo.costing.domain.CostingSnapshots.RecipeSnapshot;
import net.argeneo.costing.entity.Recipe;
import net.argeneo.costing.entity.RecipeComponent;
import net.argeneo.costing.repository.RawMaterialRepository;
import net.argeneo.costing.repository.RecipeComponentRepository;
import net.argeneo.costing.repository.RecipeRepository;
import org.springframework.stereotype.Component;

/**
 * Adaptateur JPA -> moteur : fournit au {@link net.argeneo.costing.domain.CostEngine}
 * les photos dont il a besoin, depuis la base. Tenant-scopé via les repositories.
 */
@Component
public class CostingCatalogAdapter implements CostingCatalog {

    private final RawMaterialRepository rawMaterialRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeComponentRepository componentRepository;

    public CostingCatalogAdapter(RawMaterialRepository rawMaterialRepository,
                                 RecipeRepository recipeRepository,
                                 RecipeComponentRepository componentRepository) {
        this.rawMaterialRepository = rawMaterialRepository;
        this.recipeRepository = recipeRepository;
        this.componentRepository = componentRepository;
    }

    @Override
    public RawMaterialSnapshot rawMaterial(long rawMaterialId) {
        return rawMaterialRepository.findById(rawMaterialId)
                .map(m -> new RawMaterialSnapshot(m.getId(), m.getName(),
                        m.getReferenceUnit(), m.getPricePerUnit()))
                .orElseThrow(() -> new CostingException("Matière première introuvable : " + rawMaterialId));
    }

    @Override
    public RecipeSnapshot recipe(long articleId) {
        Recipe recipe = recipeRepository.findByArticleId(articleId)
                .orElseThrow(() -> new CostingException("Recette introuvable pour l'article " + articleId));

        var components = componentRepository.findByRecipeId(recipe.getId()).stream()
                .map(this::toSnapshot)
                .toList();

        return new RecipeSnapshot(articleId, recipe.getYieldQuantity(),
                recipe.getYieldUnit(), recipe.getLossRate(), components);
    }

    private ComponentSnapshot toSnapshot(RecipeComponent c) {
        long refId = c.getType() == ComponentType.RAW ? c.getRawMaterialId() : c.getSubArticleId();
        return new ComponentSnapshot(c.getType(), refId, c.getQuantity(), c.getUnit());
    }
}
