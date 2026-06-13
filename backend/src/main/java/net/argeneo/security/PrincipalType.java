package net.argeneo.security;

/** Nature du principal authentifié. */
public enum PrincipalType {
    /** Super-Admin plateforme. */
    ADMIN,
    /** Utilisateur métier (Patron ou Employé) rattaché à un tenant. */
    USER
}
