package net.argeneo.costing.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import net.argeneo.costing.domain.Pricing.Margin;
import org.junit.jupiter.api.Test;

class PricingTest {

    @Test
    void ht_from_ttc_with_55_percent() {
        // 1,055 € TTC à 5,5 % -> 1,00 € HT
        BigDecimal ht = Pricing.htFromTtc(new BigDecimal("1.055"), new BigDecimal("0.055"));
        assertThat(ht).isEqualByComparingTo("1");
    }

    @Test
    void ttc_from_ht_roundtrip() {
        BigDecimal ttc = Pricing.ttcFromHt(new BigDecimal("2"), new BigDecimal("0.20"));
        assertThat(ttc).isEqualByComparingTo("2.4");
        assertThat(Pricing.htFromTtc(ttc, new BigDecimal("0.20"))).isEqualByComparingTo("2");
    }

    @Test
    void margin_metrics() {
        // PNET 0,40 € ; PV HT 1,00 € -> marge 0,60 ; marque 60 % ; marge/coût 150 % ; coef 2,5
        Margin m = Pricing.margin(new BigDecimal("0.40"), new BigDecimal("1.00"));
        assertThat(m.marginHt()).isEqualByComparingTo("0.60");
        assertThat(m.markupRate()).isEqualByComparingTo("0.6");
        assertThat(m.marginRate()).isEqualByComparingTo("1.5");
        assertThat(m.coefficient()).isEqualByComparingTo("2.5");
    }

    @Test
    void margin_empty_without_sale_price() {
        assertThat(Pricing.margin(new BigDecimal("1"), null)).isEqualTo(Margin.EMPTY);
    }
}
