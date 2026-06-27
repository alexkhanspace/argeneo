package net.argeneo.iam.service;

import java.util.ArrayList;
import java.util.List;
import net.argeneo.audit.AuditService;
import net.argeneo.common.error.ResourceNotFoundException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Vue Super-Admin sur TOUS les comptes (toutes enseignes) + réinitialisation de
 * mot de passe. Accès cross-tenant délibéré via {@link JdbcTemplate} (hors filtre
 * {@code @TenantId}), réservé au Super-Admin par la sécurité d'URL {@code /api/admin/**}.
 */
@Service
public class AdminUserService {

    /** Une ligne de la vue « tous les utilisateurs ». */
    public record AdminUserRow(
            String kind,        // ADMIN | USER
            Long id,
            String email,
            String fullName,
            String role,        // SUPER_ADMIN | PATRON | EMPLOYE
            Long tenantId,
            String tenantName,
            boolean active) {
    }

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;

    public AdminUserService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, AuditService audit) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<AdminUserRow> listAll() {
        List<AdminUserRow> rows = new ArrayList<>();

        jdbc.query("SELECT id, email, full_name, active FROM platform_admin ORDER BY email",
                (rs, i) -> new AdminUserRow("ADMIN", rs.getLong("id"), rs.getString("email"),
                        rs.getString("full_name"), "SUPER_ADMIN", null, null, rs.getBoolean("active")))
                .forEach(rows::add);

        jdbc.query("""
                        SELECT u.id, u.email, u.full_name, u.role, u.tenant_id, t.name AS tenant_name, u.active
                        FROM app_user u JOIN tenant t ON t.id = u.tenant_id
                        ORDER BY t.name, u.role, u.full_name
                        """,
                (rs, i) -> new AdminUserRow("USER", rs.getLong("id"), rs.getString("email"),
                        rs.getString("full_name"), rs.getString("role"), rs.getLong("tenant_id"),
                        rs.getString("tenant_name"), rs.getBoolean("active")))
                .forEach(rows::add);

        return rows;
    }

    /**
     * Désactive (soft-delete) un utilisateur métier, ce qui coupe sa connexion.
     * Opération cross-tenant délibérée via {@link JdbcTemplate} (hors filtre
     * {@code @TenantId}). On se borne aux comptes {@code app_user} : les comptes
     * Super-Admin ({@code platform_admin}) ne peuvent pas être désactivés ici.
     */
    @Transactional
    public void deactivateUser(Long id) {
        int updated = jdbc.update("UPDATE app_user SET active = false WHERE id = ?", id);
        if (updated == 0) {
            throw new ResourceNotFoundException("Utilisateur introuvable : USER/" + id);
        }
        audit.record("USER_DEACTIVATE", "USER", id, "Désactivation de l'utilisateur " + id);
    }

    /**
     * Change le rôle d'un utilisateur métier ({@code app_user}) entre PATRON et EMPLOYE.
     * Opération cross-tenant (Super-Admin). Refuse de retirer le dernier patron actif d'une
     * enseigne pour éviter de la rendre ingérable. Les Super-Admins ne sont pas concernés.
     */
    @Transactional
    public void setUserRole(Long id, String role) {
        if (!"PATRON".equals(role) && !"EMPLOYE".equals(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rôle invalide : " + role);
        }
        Long tenantId;
        try {
            tenantId = jdbc.queryForObject("SELECT tenant_id FROM app_user WHERE id = ?", Long.class, id);
        } catch (EmptyResultDataAccessException e) {
            throw new ResourceNotFoundException("Utilisateur introuvable : USER/" + id);
        }
        if ("EMPLOYE".equals(role)) {
            Integer otherPatrons = jdbc.queryForObject(
                    "SELECT count(*) FROM app_user WHERE tenant_id = ? AND role = 'PATRON' AND active = true AND id <> ?",
                    Integer.class, tenantId, id);
            if (otherPatrons == null || otherPatrons == 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Impossible de rétrograder le dernier patron de l'enseigne.");
            }
        }
        jdbc.update("UPDATE app_user SET role = ? WHERE id = ?", role, id);
        audit.record("USER_ROLE_CHANGE", "USER", id, "Rôle changé en " + role + " pour l'utilisateur " + id);
    }

    @Transactional
    public void resetPassword(String kind, Long id, String newPassword) {
        String hash = passwordEncoder.encode(newPassword);
        String table = "ADMIN".equals(kind) ? "platform_admin" : "app_user";
        int updated = jdbc.update("UPDATE " + table + " SET password_hash = ? WHERE id = ?", hash, id);
        if (updated == 0) {
            throw new ResourceNotFoundException("Utilisateur introuvable : " + kind + "/" + id);
        }
    }
}
