package net.argeneo.costing.service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import net.argeneo.audit.AuditService;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.api.dto.ArticleDtos.ArticleResponse;
import net.argeneo.costing.api.dto.ArticleDtos.CreateArticleRequest;
import net.argeneo.costing.api.dto.ArticleDtos.UpdateArticleRequest;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.entity.ArticleType;
import net.argeneo.costing.entity.FamilleScope;
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
    private final FamilleService familleService;
    private final AuditService audit;

    public ArticleService(ArticleRepository articleRepository,
                          RecipeRepository recipeRepository,
                          RecipeComponentRepository componentRepository,
                          FamilleService familleService,
                          AuditService audit) {
        this.articleRepository = articleRepository;
        this.recipeRepository = recipeRepository;
        this.componentRepository = componentRepository;
        this.familleService = familleService;
        this.audit = audit;
    }

    @Transactional
    public ArticleResponse create(CreateArticleRequest request) {
        familleService.validateAssignment(FamilleScope.ARTICLE, request.familleId(), request.sousFamilleId());
        Article article = new Article();
        article.setCode(nextCode(request.type()));
        article.setName(request.name());
        article.setType(request.type());
        article.setUnit(request.unit());
        article.setSalePriceTtc(request.salePriceTtc());
        article.setVatRate(request.vatRate());
        article.setDescription(request.description());
        article.setFamilleId(request.familleId());
        article.setSousFamilleId(request.sousFamilleId());
        if (request.type() == ArticleType.ACHAT_REVENTE) {
            article.setPurchasePrice(request.purchasePrice());
        }
        Article saved = articleRepository.save(article);
        audit.record("ARTICLE_CREATE", "ARTICLE", saved.getId(),
                "Article " + saved.getCode() + " (" + saved.getName() + ")");
        return toResponse(saved, false);
    }

    @Transactional
    public ArticleResponse update(Long id, UpdateArticleRequest request) {
        Article article = articleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Article introuvable : " + id));
        familleService.validateAssignment(FamilleScope.ARTICLE, request.familleId(), request.sousFamilleId());
        // Le code et le type restent figés depuis la création ; seuls les champs ci-dessous sont éditables.
        article.setName(request.name());
        article.setUnit(request.unit());
        article.setSalePriceTtc(request.salePriceTtc());
        article.setVatRate(request.vatRate());
        // La photo n'est pas modifiée ici (gérée par l'upload dédié), seul le GTIN l'est.
        article.setGtin(request.gtin());
        article.setDescription(request.description());
        article.setFamilleId(request.familleId());
        article.setSousFamilleId(request.sousFamilleId());
        if (article.getType() == ArticleType.ACHAT_REVENTE) {
            article.setPurchasePrice(request.purchasePrice());
        }
        Article saved = articleRepository.save(article);
        boolean hasRecipe = recipeRepository.findByArticleId(id).isPresent();
        audit.record("ARTICLE_UPDATE", "ARTICLE", id,
                "Article " + saved.getCode() + " (" + saved.getName() + ")");
        return toResponse(saved, hasRecipe);
    }

    @Transactional(readOnly = true)
    public List<ArticleResponse> list() {
        Set<Long> withRecipe = recipeRepository.findAll().stream()
                .map(Recipe::getArticleId).collect(Collectors.toSet());
        Map<Long, String> names = familleService.namesByScope(FamilleScope.ARTICLE);
        return articleRepository.findAllByOrderByCodeAsc().stream()
                .map(a -> ArticleResponse.from(a, withRecipe.contains(a.getId()),
                        names.get(a.getFamilleId()), names.get(a.getSousFamilleId())))
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
        audit.record("ARTICLE_DELETE", "ARTICLE", id,
                "Article " + article.getCode() + " (" + article.getName() + ")");
    }

    /** Code séquentiel par préfixe (A = acheté-revendu, R = fabriqué, M = menu), scopé tenant. */
    private String nextCode(ArticleType type) {
        String prefix = switch (type) {
            case FABRIQUE -> "R";
            case MENU -> "M";
            default -> "A";
        };
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
        return toResponse(article, hasRecipe);
    }

    /** Réponse enrichie des noms de famille/sous-famille (résolus pour cet article). */
    private ArticleResponse toResponse(Article a, boolean hasRecipe) {
        Map<Long, String> names = familleService.namesByScope(FamilleScope.ARTICLE);
        return ArticleResponse.from(a, hasRecipe,
                names.get(a.getFamilleId()), names.get(a.getSousFamilleId()));
    }
}
