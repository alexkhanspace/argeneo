package net.argeneo.billing.domain;

/** Cycle de vie d'un document de facturation (devis ou facture). */
public enum DocumentStatus {
    BROUILLON,
    EMIS,
    ACCEPTE,
    REFUSE,
    PAYE,
    ANNULE
}
