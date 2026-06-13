package net.argeneo.costing.repository;

import java.util.List;
import net.argeneo.costing.entity.RecipeComponent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

/** Composants de recette du tenant courant (filtrage tenant automatique). */
public interface RecipeComponentRepository extends JpaRepository<RecipeComponent, Long> {

    List<RecipeComponent> findByRecipeId(Long recipeId);

    @Transactional
    void deleteByRecipeId(Long recipeId);
}
