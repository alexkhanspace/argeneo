package net.argeneo.costing.domain;

/** Tentative de conversion entre deux unités de dimensions différentes. */
public class IncompatibleUnitsException extends CostingException {
    public IncompatibleUnitsException(Unit from, Unit to) {
        super("Unités incompatibles : " + from + " (" + from.dimension() + ") -> "
                + to + " (" + to.dimension() + ")");
    }
}
