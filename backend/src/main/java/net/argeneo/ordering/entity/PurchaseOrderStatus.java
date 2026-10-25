package net.argeneo.ordering.entity;

/** Cycle de vie : brouillon (modifiable) → validée (envoyée au fournisseur) → reçue (livraison pointée). */
public enum PurchaseOrderStatus {
    BROUILLON,
    VALIDEE,
    RECUE
}
