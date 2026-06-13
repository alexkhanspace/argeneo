package net.argeneo.costing.domain;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

/**
 * Conversions de prix HT/TTC et indicateurs de marge. Domaine pur.
 *
 * <p>Convention Argeneo : tout est en HT (matières, PNET) SAUF le prix de vente,
 * saisi en TTC (prix client). Le HT s'en déduit via le taux de TVA de l'article ;
 * la marge se calcule entre le prix de vente HT et le PNET (coût de revient HT).</p>
 */
public final class Pricing {

    private static final MathContext MC = new MathContext(16, RoundingMode.HALF_UP);
    private static final BigDecimal ONE = BigDecimal.ONE;

    private Pricing() {
    }

    /** Indicateurs de marge (valeurs {@code null} si non calculables). */
    public record Margin(
            BigDecimal marginHt,
            BigDecimal markupRate,   // taux de marque = marge / PV HT
            BigDecimal marginRate,   // taux de marge  = marge / coût HT
            BigDecimal coefficient   // coefficient    = PV HT / coût HT
    ) {
        public static final Margin EMPTY = new Margin(null, null, null, null);
    }

    public static BigDecimal htFromTtc(BigDecimal priceTtc, BigDecimal vatRate) {
        if (priceTtc == null) {
            return null;
        }
        BigDecimal vat = vatRate == null ? BigDecimal.ZERO : vatRate;
        return priceTtc.divide(ONE.add(vat), MC);
    }

    public static BigDecimal ttcFromHt(BigDecimal priceHt, BigDecimal vatRate) {
        if (priceHt == null) {
            return null;
        }
        BigDecimal vat = vatRate == null ? BigDecimal.ZERO : vatRate;
        return priceHt.multiply(ONE.add(vat), MC);
    }

    /** Marge entre un prix de vente HT et un coût de revient HT (PNET). */
    public static Margin margin(BigDecimal pnetHt, BigDecimal salePriceHt) {
        if (salePriceHt == null || pnetHt == null) {
            return Margin.EMPTY;
        }
        BigDecimal marginHt = salePriceHt.subtract(pnetHt);
        BigDecimal markupRate = salePriceHt.signum() == 0 ? null : marginHt.divide(salePriceHt, MC);
        BigDecimal marginRate = pnetHt.signum() == 0 ? null : marginHt.divide(pnetHt, MC);
        BigDecimal coefficient = pnetHt.signum() == 0 ? null : salePriceHt.divide(pnetHt, MC);
        return new Margin(marginHt, markupRate, marginRate, coefficient);
    }
}
