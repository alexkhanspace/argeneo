package net.argeneo.costing.domain;

import java.util.List;
import java.util.stream.Collectors;

/** Cycle détecté dans le graphe de sous-recettes (ex. A utilise B utilise A). */
public class CostingCycleException extends CostingException {
    public CostingCycleException(List<Long> path, long repeated) {
        super("Cycle de sous-recettes détecté : "
                + path.stream().map(String::valueOf).collect(Collectors.joining(" -> "))
                + " -> " + repeated);
    }
}
