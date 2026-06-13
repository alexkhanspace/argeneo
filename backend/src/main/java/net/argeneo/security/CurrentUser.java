package net.argeneo.security;

import org.springframework.security.core.context.SecurityContextHolder;

/** Accès au principal authentifié courant. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static AuthPrincipal require() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthPrincipal principal) {
            return principal;
        }
        throw new IllegalStateException("Aucun utilisateur authentifié dans le contexte");
    }
}
