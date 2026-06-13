package net.argeneo.iam.domain;

/** Portée des recettes au sein d'un tenant (réglage de l'enseigne). */
public enum RecipeScope {
    /** Recettes communes à toute l'enseigne. */
    ENSEIGNE,
    /** Recettes propres à chaque etablissement. */
    ETABLISSEMENT
}
