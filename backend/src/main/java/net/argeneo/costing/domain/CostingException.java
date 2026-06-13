package net.argeneo.costing.domain;

/** Erreur du domaine de calcul de coût (racine). */
public class CostingException extends RuntimeException {
    public CostingException(String message) {
        super(message);
    }
}
