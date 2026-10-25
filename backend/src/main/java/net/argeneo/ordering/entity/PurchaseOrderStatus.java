package net.argeneo.ordering.entity;

/** Cycle de vie d'une commande : brouillon (modifiable) puis validée (envoyée au fournisseur). */
public enum PurchaseOrderStatus {
    BROUILLON,
    VALIDEE
}
