package net.argeneo.costing.entity;

/** Nature d'un article. */
public enum ArticleType {
    /** Acheté-revendu (ex. canette) : pas de recette, PNET = prix d'achat. */
    ACHAT_REVENTE,
    /** Fabriqué (ex. croissant) : possède une recette, PNET calculé par le moteur. */
    FABRIQUE
}
