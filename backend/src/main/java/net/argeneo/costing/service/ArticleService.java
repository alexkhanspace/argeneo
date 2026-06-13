package net.argeneo.costing.service;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.api.dto.ArticleDtos.ArticleResponse;
import net.argeneo.costing.api.dto.ArticleDtos.CreateArticleRequest;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.entity.ArticleType;
import net.argeneo.costing.entity.Recipe;
import net.argeneo.costing.repository.ArticleRepository;
import net.argeneo.costing.repository.RecipeComponentRepository;
import net.argeneo.costing.repository.RecipeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Gestion des articles (parcours Patron). */
@Service
public class ArticleService {

    private final ArticleRepository articleRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeComponentRepository componentRepository;

    public ArticleService(ArticleRepository articleRepository,
                          RecipeRepository recipeRepository,
                          RecipeComponentRepository componentRepository) {
        this.articleRepository = articleRepository;
        this.recipeRepository = recipeRepository;
        this.componentRepository = componentRepository;
    }

    @Transactional
    public ArticleResponse create(CreateArticleRequest request) {
        Article article = new Article();
        article.setCode(nextCode(request.type()));
        article.setName(request.name());
        article.setType(request.type());
        article.setUnit(request.unit());
        article.setSalePriceTtc(request.salePriceTtc());
        article.setVatRate(request.vatRate());
        if (request.type() == ArticleType.ACHAT_REVENTE) {
            article.setPurchasePrice(request.purchasePrice());
        }
        return ArticleResponse.from(articleRepository.save(article), false);
    }

    @Transactional(readOnly = true)
    public List<ArticleResponse> list() {
        Set<Long> withRecipe = recipeRepository.findAll().stream()
                .map(Recipe::getArticleId).collect(Collectors.toSet());
        return articleRepository.findAllByOrderByCodeAsc().stream()
                .map(a -> ArticleResponse.from(a, withRecipe.contains(a.getId())))
                .toList();
    }

    @Transactional
    public void delete(Long id) {
        Article article = articleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Article introuvable : " + id));
        if (componentRepository.existsBySubArticleId(article.getId())) {
            throw new ConflictException(
                    "Cet article est utilisé comme sous-recette ; retirez-le des recettes concernées d'abord.");
        }
        // La recette et ses composants sont supprimés en cascade (FK ON DELETE CASCADE).
        articleRepository.delete(article);
    }

    /** Code séquentiel par préfixe (A = acheté-revendu, R = fabriqué), scopé tenant. */
    private String nextCode(ArticleType type) {
        String prefix = type == ArticleType.FABRIQUE ? "R" : "A";
        int next = articleRepository.findFirstByCodeStartingWithOrderByCodeDesc(prefix)
                .map(a -> Integer.parseInt(a.getCode().substring(1)) + 1)
                .orElse(1);
        return prefix + String.format("%04d", next);
    }

    @Transactional(readOnly = true)
    public ArticleResponse get(Long id) {
        Article article = articleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Article introuvable : " + id));
        boolean hasRecipe = recipeRepository.findByArticleId(id).isPresent();
        return ArticleResponse.from(article, hasRecipe);
    }
}
