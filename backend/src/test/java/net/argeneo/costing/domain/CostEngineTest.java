package net.argeneo.costing.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import net.argeneo.costing.domain.CostingSnapshots.ComponentSnapshot;
import net.argeneo.costing.domain.CostingSnapshots.ComponentType;
import net.argeneo.costing.domain.CostingSnapshots.RawMaterialSnapshot;
import net.argeneo.costing.domain.CostingSnapshots.RecipeSnapshot;
import org.junit.jupiter.api.Test;

class CostEngineTest {

    private final CostEngine engine = new CostEngine();

    /** Catalogue en mémoire, modifiable, pour piloter les scénarios. */
    static class InMemoryCatalog implements CostingCatalog {
        final Map<Long, RawMaterialSnapshot> materials = new HashMap<>();
        final Map<Long, RecipeSnapshot> recipes = new HashMap<>();

        @Override
        public RawMaterialSnapshot rawMaterial(long id) {
            RawMaterialSnapshot m = materials.get(id);
            if (m == null) throw new CostingException("Matière introuvable: " + id);
            return m;
        }

        @Override
        public RecipeSnapshot recipe(long articleId) {
            RecipeSnapshot r = recipes.get(articleId);
            if (r == null) throw new CostingException("Recette introuvable: " + articleId);
            return r;
        }
    }

    private static ComponentSnapshot raw(long id, String qty, Unit unit) {
        return new ComponentSnapshot(ComponentType.RAW, id, new BigDecimal(qty), unit);
    }

    private static ComponentSnapshot sub(long id, String qty, Unit unit) {
        return new ComponentSnapshot(ComponentType.SUBRECIPE, id, new BigDecimal(qty), unit);
    }

    @Test
    void converts_units_within_a_dimension() {
        InMemoryCatalog cat = new InMemoryCatalog();
        // Beurre à 10 €/kg, recette qui consomme 250 g -> 2,50 €
        cat.materials.put(1L, new RawMaterialSnapshot(1L, "Beurre", Unit.KG, new BigDecimal("10")));
        cat.recipes.put(10L, new RecipeSnapshot(10L, new BigDecimal("1"), Unit.PIECE, BigDecimal.ZERO,
                List.of(raw(1L, "250", Unit.G))));

        CostResult result = engine.computeUnitCost(10L, cat);

        assertThat(result.batchCost()).isEqualByComparingTo("2.5");
        assertThat(result.unitCost()).isEqualByComparingTo("2.5");
    }

    @Test
    void computes_nested_subrecipe_cost() {
        InMemoryCatalog cat = butterCroissantCatalog(new BigDecimal("10"));
        CostResult croissant = engine.computeUnitCost(200L, cat);

        // batch = sous-recette(600g @0.003) 1.8 + beurre(50g @10€/kg) 0.5 = 2.3
        // rendement effectif = 10 * (1 - 0.1) = 9 pièces -> 2.3 / 9
        assertThat(croissant.batchCost()).isEqualByComparingTo("2.3");
        assertThat(croissant.effectiveYield()).isEqualByComparingTo("9.0");
        assertThat(croissant.unitCost()).isEqualByComparingTo(new BigDecimal("0.2555555555555556"));
        assertThat(croissant.lines()).hasSize(2);
    }

    @Test
    void butter_price_up_makes_croissant_follow() {
        BigDecimal before = engine.computeUnitCost(200L, butterCroissantCatalog(new BigDecimal("10"))).unitCost();
        BigDecimal after = engine.computeUnitCost(200L, butterCroissantCatalog(new BigDecimal("15"))).unitCost();

        assertThat(after).isGreaterThan(before);
    }

    @Test
    void detects_subrecipe_cycle() {
        InMemoryCatalog cat = new InMemoryCatalog();
        cat.recipes.put(300L, new RecipeSnapshot(300L, new BigDecimal("1"), Unit.PIECE, BigDecimal.ZERO,
                List.of(sub(301L, "1", Unit.PIECE))));
        cat.recipes.put(301L, new RecipeSnapshot(301L, new BigDecimal("1"), Unit.PIECE, BigDecimal.ZERO,
                List.of(sub(300L, "1", Unit.PIECE))));

        assertThatThrownBy(() -> engine.computeUnitCost(300L, cat))
                .isInstanceOf(CostingCycleException.class);
    }

    @Test
    void rejects_incompatible_units() {
        InMemoryCatalog cat = new InMemoryCatalog();
        cat.materials.put(1L, new RawMaterialSnapshot(1L, "Lait", Unit.L, new BigDecimal("1")));
        cat.recipes.put(10L, new RecipeSnapshot(10L, new BigDecimal("1"), Unit.PIECE, BigDecimal.ZERO,
                List.of(raw(1L, "100", Unit.G)))); // g (masse) vs L (volume)

        assertThatThrownBy(() -> engine.computeUnitCost(10L, cat))
                .isInstanceOf(IncompatibleUnitsException.class);
    }

    /**
     * Beurre (prix variable) + Farine 1 €/kg.
     * Pâte feuilletée #100 : 1000 g, 250 g beurre + 500 g farine.
     * Croissant #200 : 10 pièces, perte 10 %, 600 g pâte + 50 g beurre.
     */
    private InMemoryCatalog butterCroissantCatalog(BigDecimal butterPricePerKg) {
        InMemoryCatalog cat = new InMemoryCatalog();
        cat.materials.put(1L, new RawMaterialSnapshot(1L, "Beurre", Unit.KG, butterPricePerKg));
        cat.materials.put(2L, new RawMaterialSnapshot(2L, "Farine", Unit.KG, new BigDecimal("1")));
        cat.recipes.put(100L, new RecipeSnapshot(100L, new BigDecimal("1000"), Unit.G, BigDecimal.ZERO,
                List.of(raw(1L, "250", Unit.G), raw(2L, "500", Unit.G))));
        cat.recipes.put(200L, new RecipeSnapshot(200L, new BigDecimal("10"), Unit.PIECE, new BigDecimal("0.1"),
                List.of(sub(100L, "600", Unit.G), raw(1L, "50", Unit.G))));
        return cat;
    }
}
