package net.argeneo.costing.api;

import jakarta.validation.Valid;
import net.argeneo.costing.api.dto.RecipeDtos.RecipeResponse;
import net.argeneo.costing.api.dto.RecipeDtos.UpsertRecipeRequest;
import net.argeneo.costing.service.RecipeService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Recette d'un article fabriqué (parcours Patron). */
@RestController
@RequestMapping("/api/articles/{articleId}/recipe")
@PreAuthorize("hasRole('PATRON')")
public class RecipeController {

    private final RecipeService recipeService;

    public RecipeController(RecipeService recipeService) {
        this.recipeService = recipeService;
    }

    @GetMapping
    public RecipeResponse get(@PathVariable Long articleId) {
        return recipeService.getRecipe(articleId);
    }

    @PutMapping
    public RecipeResponse upsert(@PathVariable Long articleId,
                                 @Valid @RequestBody UpsertRecipeRequest request) {
        return recipeService.upsert(articleId, request);
    }
}
