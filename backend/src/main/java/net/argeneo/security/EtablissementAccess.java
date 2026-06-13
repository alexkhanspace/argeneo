package net.argeneo.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Vérifie les autorités contextualisées par etablissement (forme {@code code:etablissementId}),
 * utilisable dans les expressions {@code @PreAuthorize}. Le Patron a tout sur son tenant.
 */
@Component("etablissementAccess")
public class EtablissementAccess {

    /** Vrai si l'utilisateur courant a {@code permission} sur la etablissement (ou est Patron). */
    public boolean has(long etablissementId, String permission) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        if (isPatron(auth)) {
            return true;
        }
        String needed = permission + ":" + etablissementId;
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(needed));
    }

    public boolean canRevenue(long etablissementId) {
        return has(etablissementId, "saisir_ca");
    }

    public boolean canLoss(long etablissementId) {
        return has(etablissementId, "saisir_perte");
    }

    public boolean canNote(long etablissementId) {
        return has(etablissementId, "saisir_mot_du_jour");
    }

    /** Lecture de la saisie quotidienne : Patron, ou tout employé ayant une permission de saisie. */
    public boolean canReadDaily(long etablissementId) {
        return has(etablissementId, "saisir_ca")
                || has(etablissementId, "saisir_perte")
                || has(etablissementId, "saisir_mot_du_jour");
    }

    private boolean isPatron(Authentication auth) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_PATRON"));
    }
}
