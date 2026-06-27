package net.argeneo.costing.entity;

/** Périmètre d'une famille : les arborescences des produits et des matières sont séparées. */
public enum FamilleScope {
    /** Familles des articles (produits). */
    ARTICLE,
    /** Familles des matières premières. */
    RAW_MATERIAL
}
