package net.argeneo.billing.domain;

/** Nature d'un client. */
public enum ClientKind {
    /** Professionnel (entreprise) : SIRET / TVA intracommunautaire. */
    PRO,
    /** Particulier. */
    PARTICULIER
}
