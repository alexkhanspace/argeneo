package net.argeneo.billing.domain;

/** Nature d'un document de facturation. */
public enum DocumentType {
    /** Devis : proposition commerciale, non comptable. */
    DEVIS,
    /** Facture : pièce comptable. */
    FACTURE
}
