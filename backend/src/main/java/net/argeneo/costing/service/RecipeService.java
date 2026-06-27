package net.argeneo.costing.service;

import java.util.List;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.api.dto.RecipeDtos.ComponentRequest;
import net.argeneo.costing.api.dto.RecipeDtos.ComponentResponse;
import net.argeneo.costing.api.dto.RecipeDtos.RecipeResponse;
import net.argeneo.costing.api.dto.RecipeDtos.UpsertRecipeRequest;
import net.argeneo.costing.domain.CostingSnapshots.ComponentType;
import net.argeneo.costing.domain.Unit;
import net.argeneo.costing.entity.RawMaterial;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.entity.ArticleType;
import net.argeneo.costing.entity.Recipe;
import net.argeneo.costing.entity.RecipeComponent;
import net.argeneo.costing.entity.RecipeStep;
import net.argeneo.costing.repository.ArticleRepository;
import net.argeneo.costing.repository.RawMaterialRepository;
import net.argeneo.costing.repository.RecipeComponentRepository;
import net.argeneo.costing.repository.RecipeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Gestion des recettes : composants (matières + sous-recettes), rendement, perte. */
@Service
public class RecipeService {

    private final ArticleRepository articleRepository;
    private final RawMaterialRepository rawMaterialRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeComponentRepository componentRepository;

    public RecipeService(ArticleRepository articleRepository,
                         RawMaterialRepository rawMaterialRepository,
                         RecipeRepository recipeRepository,
                         RecipeComponentRepository componentRepository) {
        this.articleRepository = articleRepository;
        this.rawMaterialRepository = rawMaterialRepository;
        this.recipeRepository = recipeRepository;
        this.componentRepository = componentRepository;
    }

    @Transactional(readOnly = true)
    public RecipeResponse getRecipe(Long articleId) {
        Recipe recipe = recipeRepository.findByArticleId(articleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Aucune recette pour l'article " + articleId));
        return toResponse(recipe);
    }

    @Transactional
    public RecipeResponse upsert(Long articleId, UpsertRecipeRequest request) {
        Article article = articleRepository.findById(articleId)
                .orElseThrow(() -> new ResourceNotFoundException("Article introuvable : " + articleId));
        if (article.getType() != ArticleType.FABRIQUE) {
            throw new IllegalArgumentException("Seuls les articles fabriqués ont une recette");
        }

        List<ComponentRequest> components = request.components() == null ? List.of() : request.components();
        for (ComponentRequest c : components) {
            validateComponent(articleId, c);
        }

        Recipe recipe = recipeRepository.findByArticleId(articleId).orElseGet(() -> {
            Recipe created = new Recipe();
            created.setArticleId(articleId);
            return created;
        });
        recipe.setYieldQuantity(request.yieldQuantity());
        recipe.setYieldUnit(request.yieldUnit());
        recipe.setLossRate(request.lossRate());
        recipe.setMethod(request.method());
        recipe.setDurationMinutes(request.durationMinutes());

        // Remplace les étapes : on vide la collection (orphanRemoval) et on recrée par ordre d'index.
        recipe.getSteps().clear();
        List<String> steps = request.steps() == null ? List.of() : request.steps();
        int position = 0;
        for (String instruction : steps) {
            if (instruction == null || instruction.isBlank()) {
                continue;
            }
            RecipeStep step = new RecipeStep();
            step.setPosition(position++);
            step.setInstruction(instruction.trim());
            recipe.getSteps().add(step);
        }
        recipe = recipeRepository.save(recipe);

        componentRepository.deleteByRecipeId(recipe.getId());
        componentRepository.flush();
        for (ComponentRequest c : components) {
            RecipeComponent rc = new RecipeComponent();
            rc.setRecipeId(recipe.getId());
            rc.setType(c.type());
            rc.setRawMaterialId(c.type() == ComponentType.RAW ? c.rawMaterialId() : null);
            rc.setSubArticleId(c.type() == ComponentType.SUBRECIPE ? c.subArticleId() : null);
            rc.setQuantity(c.quantity());
            rc.setUnit(c.unit());
            componentRepository.save(rc);
        }
        return toResponse(recipe);
    }

    private void validateComponent(Long articleId, ComponentRequest c) {
        if (c.type() == ComponentType.RAW) {
            if (c.rawMaterialId() == null) {
                throw new IllegalArgumentException("Composant matière : rawMaterialId requis");
            }
            RawMaterial mat = rawMaterialRepository.findById(c.rawMaterialId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Matière première introuvable : " + c.rawMaterialId()));
            requireSameDimension(c.unit(), mat.getReferenceUnit(), mat.getName());
        } else {
            if (c.subArticleId() == null) {
                throw new IllegalArgumentException("Composant sous-recette : subArticleId requis");
            }
            if (c.subArticleId().equals(articleId)) {
                throw new IllegalArgumentException("Une recette ne peut pas se référencer elle-même");
            }
            Article sub = articleRepository.findById(c.subArticleId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Article sous-recette introuvable : " + c.subArticleId()));
            if (sub.getType() != ArticleType.FABRIQUE) {
                throw new IllegalArgumentException(
                        "Une sous-recette doit être un article fabriqué : " + c.subArticleId());
            }
            requireSameDimension(c.unit(), sub.getUnit(), sub.getName());
        }
    }

    /** L'unité d'un composant doit être de même nature (poids/volume/pièce) que l'élément utilisé. */
    private static void requireSameDimension(Unit componentUnit, Unit targetUnit, String name) {
        if (componentUnit != null && targetUnit != null
                && componentUnit.dimension() != targetUnit.dimension()) {
            throw new IllegalArgumentException("Composant « " + name + " » : quantité en " + componentUnit
                    + " incompatible — cet élément est suivi en " + targetUnit
                    + ". Utilisez une unité de même nature (poids, volume ou pièce), ou changez l'unité de "
                    + "l'élément.");
        }
    }

    private RecipeResponse toResponse(Recipe recipe) {
        List<ComponentResponse> components = componentRepository.findByRecipeId(recipe.getId()).stream()
                .map(this::toComponentResponse)
                .toList();
        List<String> steps = recipe.getSteps().stream()
                .sorted(java.util.Comparator.comparing(RecipeStep::getPosition))
                .map(RecipeStep::getInstruction)
                .toList();
        return new RecipeResponse(recipe.getArticleId(), recipe.getYieldQuantity(), recipe.getYieldUnit(),
                recipe.getLossRate(), recipe.getMethod(), recipe.getDurationMinutes(), components, steps);
    }

    private ComponentResponse toComponentResponse(RecipeComponent c) {
        String label;
        if (c.getType() == ComponentType.RAW) {
            label = rawMaterialRepository.findById(c.getRawMaterialId())
                    .map(m -> m.getName()).orElse("Matière #" + c.getRawMaterialId());
        } else {
            label = articleRepository.findById(c.getSubArticleId())
                    .map(a -> a.getName()).orElse("Article #" + c.getSubArticleId());
        }
        return new ComponentResponse(c.getId(), c.getType(), c.getRawMaterialId(), c.getSubArticleId(),
                label, c.getQuantity(), c.getUnit());
    }
}
