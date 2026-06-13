package net.argeneo.costing.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import net.argeneo.costing.domain.Pricing;
import net.argeneo.costing.domain.Unit;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.entity.ArticleType;

/** DTOs des articles. Convention : prix de vente en TTC, le reste (achat, PNET) en HT. */
public final class ArticleDtos {

    private ArticleDtos() {
    }

    public record CreateArticleRequest(
            @NotBlank String name,
            @NotNull ArticleType type,
            @NotNull Unit unit,
            /** Prix de vente TTC (prix client). */
            @PositiveOrZero BigDecimal salePriceTtc,
            /** Taux de TVA (ex. 0.055, 0.10, 0.20). */
            @PositiveOrZero BigDecimal vatRate,
            /** Prix d'achat HT pour ACHAT_REVENTE (= PNET). */
            @PositiveOrZero BigDecimal purchasePrice) {
    }

    public record ArticleResponse(
            Long id,
            String name,
            ArticleType type,
            Unit unit,
            BigDecimal salePriceTtc,
            BigDecimal salePriceHt,
            BigDecimal vatRate,
            BigDecimal purchasePrice,
            boolean active,
            boolean hasRecipe) {

        public static ArticleResponse from(Article a, boolean hasRecipe) {
            BigDecimal salePriceHt = Pricing.htFromTtc(a.getSalePriceTtc(), a.getVatRate());
            return new ArticleResponse(a.getId(), a.getName(), a.getType(), a.getUnit(),
                    a.getSalePriceTtc(), salePriceHt, a.getVatRate(), a.getPurchasePrice(),
                    a.isActive(), hasRecipe);
        }
    }
}
