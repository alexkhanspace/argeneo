package net.argeneo.costing.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import net.argeneo.costing.domain.Unit;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.entity.ArticleType;

/** DTOs des articles. */
public final class ArticleDtos {

    private ArticleDtos() {
    }

    public record CreateArticleRequest(
            @NotBlank String name,
            @NotNull ArticleType type,
            @NotNull Unit unit,
            @PositiveOrZero BigDecimal salePrice,
            @PositiveOrZero BigDecimal vatRate,
            /** Requis pour ACHAT_REVENTE (= PNET). */
            @PositiveOrZero BigDecimal purchasePrice) {
    }

    public record ArticleResponse(
            Long id,
            String name,
            ArticleType type,
            Unit unit,
            BigDecimal salePrice,
            BigDecimal vatRate,
            BigDecimal purchasePrice,
            boolean active,
            boolean hasRecipe) {

        public static ArticleResponse from(Article a, boolean hasRecipe) {
            return new ArticleResponse(a.getId(), a.getName(), a.getType(), a.getUnit(),
                    a.getSalePrice(), a.getVatRate(), a.getPurchasePrice(), a.isActive(), hasRecipe);
        }
    }
}
