package net.argeneo.security;

import java.util.List;
import java.util.Optional;
import net.argeneo.iam.domain.UserRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Lookup d'authentification PAR E-MAIL, hors filtre tenant.
 *
 * <p>C'est le SEUL chemin cross-tenant de l'application : au login on ne connaît
 * pas encore le tenant. On passe donc par {@link JdbcTemplate} (hors Hibernate,
 * donc hors {@code @TenantId}), de manière explicite et contenue. Tout le reste
 * du code est filtré automatiquement par tenant.</p>
 */
@Component
public class AuthAccountReader {

    /** Compte authentifiable résolu par e-mail. */
    public record AuthAccount(
            Long id,
            String email,
            String fullName,
            String passwordHash,
            PrincipalType type,
            UserRole role,
            Long tenantId,
            boolean active) {
    }

    private final JdbcTemplate jdbc;

    public AuthAccountReader(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<AuthAccount> findByEmail(String email) {
        // 1) Super-Admin plateforme
        List<AuthAccount> admins = jdbc.query(
                "SELECT id, email, full_name, password_hash, active "
                        + "FROM platform_admin WHERE email = ?",
                (rs, i) -> new AuthAccount(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("full_name"),
                        rs.getString("password_hash"),
                        PrincipalType.ADMIN,
                        null,
                        null,
                        rs.getBoolean("active")),
                email);
        if (!admins.isEmpty()) {
            return Optional.of(admins.get(0));
        }

        // 2) Utilisateur métier (tous tenants confondus)
        List<AuthAccount> users = jdbc.query(
                "SELECT id, email, full_name, password_hash, role, tenant_id, active "
                        + "FROM app_user WHERE email = ?",
                (rs, i) -> new AuthAccount(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("full_name"),
                        rs.getString("password_hash"),
                        PrincipalType.USER,
                        UserRole.valueOf(rs.getString("role")),
                        rs.getLong("tenant_id"),
                        rs.getBoolean("active")),
                email);
        return users.isEmpty() ? Optional.empty() : Optional.of(users.get(0));
    }
}
