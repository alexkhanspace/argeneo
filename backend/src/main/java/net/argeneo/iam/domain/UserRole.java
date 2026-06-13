package net.argeneo.iam.domain;

/** Rôle d'un utilisateur métier (au sein d'un tenant). */
public enum UserRole {
    /** Le patron : toutes permissions sur son tenant, attribue les droits des employés. */
    PATRON,
    /** Employé : permissions composées par le patron, contextualisées par boulangerie. */
    EMPLOYE
}
