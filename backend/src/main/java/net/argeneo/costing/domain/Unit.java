package net.argeneo.costing.domain;

import java.math.BigDecimal;
import java.math.MathContext;

/**
 * Unité de mesure avec sa dimension et son facteur vers l'unité de base de la
 * dimension (g pour MASS, ml pour VOLUME, pièce pour PIECE).
 *
 * <p>Permet d'acheter en « sac de 25 kg » et de consommer en « g » : la
 * conversion {@link #convert} ramène toute quantité dans l'unité voulue, à
 * condition que les deux unités partagent la même {@link MeasureDimension}.</p>
 */
public enum Unit {

    G(MeasureDimension.MASS, new BigDecimal("1")),
    KG(MeasureDimension.MASS, new BigDecimal("1000")),
    ML(MeasureDimension.VOLUME, new BigDecimal("1")),
    L(MeasureDimension.VOLUME, new BigDecimal("1000")),
    PIECE(MeasureDimension.PIECE, new BigDecimal("1"));

    private final MeasureDimension dimension;
    private final BigDecimal factorToBase;

    Unit(MeasureDimension dimension, BigDecimal factorToBase) {
        this.dimension = dimension;
        this.factorToBase = factorToBase;
    }

    public MeasureDimension dimension() {
        return dimension;
    }

    /**
     * Convertit {@code quantity} exprimée dans cette unité vers {@code target}.
     *
     * @throws IncompatibleUnitsException si les dimensions diffèrent
     */
    public BigDecimal convert(BigDecimal quantity, Unit target, MathContext mc) {
        if (this.dimension != target.dimension) {
            throw new IncompatibleUnitsException(this, target);
        }
        if (this == target) {
            return quantity;
        }
        // quantity * (facteur source) / (facteur cible)
        return quantity.multiply(this.factorToBase, mc).divide(target.factorToBase, mc);
    }
}
