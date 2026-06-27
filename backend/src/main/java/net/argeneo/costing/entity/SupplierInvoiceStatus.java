package net.argeneo.costing.entity;

/** Cycle de vie d'une facture fournisseur scannée. */
public enum SupplierInvoiceStatus {
    /** Scannée et extraite, en attente de revue/application aux matières premières. */
    NOUVEAU,
    /** Au moins une ligne a été appliquée aux prix des matières premières. */
    TRAITEE
}
