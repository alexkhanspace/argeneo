package net.argeneo.costing.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.costing.api.dto.ArticleDtos.ArticleResponse;
import net.argeneo.costing.api.dto.ArticleDtos.CreateArticleRequest;
import net.argeneo.costing.api.dto.ArticleDtos.UpdateArticleRequest;
import net.argeneo.costing.api.dto.PnetDtos.PnetResponse;
import net.argeneo.costing.service.ArticleService;
import net.argeneo.costing.service.CostService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Articles + calcul du coût de revient (parcours Patron). */
@RestController
@RequestMapping("/api/articles")
@PreAuthorize("hasRole('PATRON')")
public class ArticleController {

    private final ArticleService articleService;
    private final CostService costService;

    public ArticleController(ArticleService articleService, CostService costService) {
        this.articleService = articleService;
        this.costService = costService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ArticleResponse create(@Valid @RequestBody CreateArticleRequest request) {
        return articleService.create(request);
    }

    @GetMapping
    public List<ArticleResponse> list() {
        return articleService.list();
    }

    @GetMapping("/{id}")
    public ArticleResponse get(@PathVariable Long id) {
        return articleService.get(id);
    }

    @PutMapping("/{id}")
    public ArticleResponse update(@PathVariable Long id,
                                  @Valid @RequestBody UpdateArticleRequest request) {
        return articleService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        articleService.delete(id);
    }

    /** Coût de revient (PNET) calculé à la volée à partir des prix nets courants. */
    @GetMapping("/{id}/cost")
    public PnetResponse cost(@PathVariable Long id) {
        return costService.computeCost(id);
    }
}
