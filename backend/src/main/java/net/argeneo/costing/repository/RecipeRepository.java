package net.argeneo.costing.repository;

import java.util.Optional;
import net.argeneo.costing.entity.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;

/** Recettes du tenant courant (filtrage tenant automatique). */
public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    Optional<Recipe> findByArticleId(Long articleId);
}
