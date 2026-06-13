package net.argeneo.security;

import net.argeneo.iam.domain.UserRole;

/**
 * Identité authentifiée, portée dans le {@code SecurityContext} et reconstruite
 * à chaque requête depuis le JWT.
 *
 * @param id       identifiant (platform_admin.id ou app_user.id selon {@code type})
 * @param role     rôle métier ({@code null} pour un Super-Admin)
 * @param tenantId tenant de rattachement ({@code null} pour un Super-Admin)
 */
public record AuthPrincipal(
        Long id,
        String email,
        String fullName,
        PrincipalType type,
        UserRole role,
        Long tenantId) {

    public boolean isSuperAdmin() {
        return type == PrincipalType.ADMIN;
    }
}
