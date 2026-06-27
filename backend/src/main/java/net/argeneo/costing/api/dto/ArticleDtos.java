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
            @PositiveOrZero BigDecimal purchasePrice,
            /** Description libre (aide l'IA : photo, conseil de prix). */
            String description,
            /** Famille de classement (optionnelle). */
            Long familleId,
            /** Sous-famille de classement (optionnelle, rattachée à familleId). */
            Long sousFamilleId) {
    }

    /**
     * Champs éditables d'un article. Le code et le type sont fixés à la création
     * (le code en découle) et ne sont donc pas modifiables ici.
     */
    public record UpdateArticleRequest(
            @NotBlank String name,
            /** Type modifiable (optionnel) : null = inchangé. Le code reste celui d'origine. */
            ArticleType type,
            @NotNull Unit unit,
            /** Prix de vente TTC (prix client). */
            @PositiveOrZero BigDecimal salePriceTtc,
            /** Taux de TVA (ex. 0.055, 0.10, 0.20). */
            @PositiveOrZero BigDecimal vatRate,
            /** Prix d'achat HT pour ACHAT_REVENTE (= PNET). */
            @PositiveOrZero BigDecimal purchasePrice,
            /** Code-barres GTIN (EAN/UPC), optionnel. La photo est gérée par l'upload. */
            String gtin,
            /** Description libre (aide l'IA : photo, conseil de prix). */
            String description,
            /** Famille de classement (optionnelle). */
            Long familleId,
            /** Sous-famille de classement (optionnelle, rattachée à familleId). */
            Long sousFamilleId) {
    }

    public record ArticleResponse(
            Long id,
            String code,
            String name,
            ArticleType type,
            Unit unit,
            BigDecimal salePriceTtc,
            BigDecimal salePriceHt,
            BigDecimal vatRate,
            BigDecimal purchasePrice,
            String gtin,
            String photoFile,
            String description,
            Long familleId,
            String familleName,
            Long sousFamilleId,
            String sousFamilleName,
            boolean active,
            boolean hasRecipe) {

        public static ArticleResponse from(Article a, boolean hasRecipe,
                                           String familleName, String sousFamilleName) {
            BigDecimal salePriceHt = Pricing.htFromTtc(a.getSalePriceTtc(), a.getVatRate());
            return new ArticleResponse(a.getId(), a.getCode(), a.getName(), a.getType(), a.getUnit(),
                    a.getSalePriceTtc(), salePriceHt, a.getVatRate(), a.getPurchasePrice(),
                    a.getGtin(), a.getPhotoFile(), a.getDescription(),
                    a.getFamilleId(), familleName, a.getSousFamilleId(), sousFamilleName,
                    a.isActive(), hasRecipe);
        }
    }
}
