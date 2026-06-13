package net.argeneo.costing.service;

import java.math.BigDecimal;
import java.util.List;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.api.dto.PnetDtos.PnetLine;
import net.argeneo.costing.api.dto.PnetDtos.PnetResponse;
import net.argeneo.costing.domain.CostEngine;
import net.argeneo.costing.domain.CostResult;
import net.argeneo.costing.domain.CostingSnapshots.ComponentType;
import net.argeneo.costing.domain.Pricing;
import net.argeneo.costing.domain.Pricing.Margin;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.entity.ArticleType;
import net.argeneo.costing.repository.ArticleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Calcul du coût de revient (PNET, HT) et de la marge vs prix de vente. */
@Service
public class CostService {

    private final CostEngine costEngine;
    private final CostingCatalogAdapter catalog;
    private final ArticleRepository articleRepository;

    public CostService(CostEngine costEngine,
                       CostingCatalogAdapter catalog,
                       ArticleRepository articleRepository) {
        this.costEngine = costEngine;
        this.catalog = catalog;
        this.articleRepository = articleRepository;
    }

    @Transactional(readOnly = true)
    public PnetResponse computeCost(Long articleId) {
        Article article = articleRepository.findById(articleId)
                .orElseThrow(() -> new ResourceNotFoundException("Article introuvable : " + articleId));

        if (article.getType() == ArticleType.ACHAT_REVENTE) {
            BigDecimal pnet = article.getPurchasePrice() == null ? BigDecimal.ZERO : article.getPurchasePrice();
            return response(article, pnet, pnet, BigDecimal.ONE, article.getUnit(), List.of());
        }

        CostResult result = costEngine.computeUnitCost(articleId, catalog);
        List<PnetLine> lines = result.lines().stream()
                .map(line -> new PnetLine(
                        line.type() == ComponentType.SUBRECIPE ? articleName(line.refId()) : line.label(),
                        line.type(), line.refId(), line.quantity(), line.unit(), line.lineCost()))
                .toList();
        return response(article, result.unitCost(), result.batchCost(),
                result.effectiveYield(), result.yieldUnit(), lines);
    }

    private PnetResponse response(Article article, BigDecimal unitCost, BigDecimal batchCost,
                                  BigDecimal effectiveYield, net.argeneo.costing.domain.Unit yieldUnit,
                                  List<PnetLine> lines) {
        BigDecimal salePriceHt = Pricing.htFromTtc(article.getSalePriceTtc(), article.getVatRate());
        Margin margin = Pricing.margin(unitCost, salePriceHt);
        return new PnetResponse(
                article.getId(), article.getName(), article.getType(),
                unitCost, article.getUnit(), batchCost, effectiveYield, yieldUnit, lines,
                article.getSalePriceTtc(), salePriceHt, article.getVatRate(),
                margin.marginHt(), margin.markupRate(), margin.marginRate(), margin.coefficient());
    }

    private String articleName(long id) {
        return articleRepository.findById(id).map(Article::getName).orElse("Article #" + id);
    }
}
