package net.argeneo.costing.domain;

import java.math.BigDecimal;
import java.util.List;

/**
 * Photos immuables des données nécessaires au calcul, découplées de la
 * persistance : le service les construit depuis JPA, le moteur ne connaît que ça.
 */
public final class CostingSnapshots {

    private CostingSnapshots() {
    }

    public enum ComponentType {
        /** Matière première achetée. */
        RAW,
        /** Sous-recette (autre article fabriqué). */
        SUBRECIPE
    }

    /** Matière première : prix net courant par unité de référence. */
    public record RawMaterialSnapshot(
            long id,
            String name,
            Unit referenceUnit,
            BigDecimal pricePerReferenceUnit) {
    }

    /** Un composant d'une recette : une quantité d'une matière ou d'une sous-recette. */
    public record ComponentSnapshot(
            ComponentType type,
            long refId,
            BigDecimal quantity,
            Unit unit) {
    }

    /** Recette d'un article fabriqué : composants + rendement + taux de perte. */
    public record RecipeSnapshot(
            long articleId,
            BigDecimal yieldQuantity,
            Unit yieldUnit,
            BigDecimal lossRate,
            List<ComponentSnapshot> components) {
    }
}
