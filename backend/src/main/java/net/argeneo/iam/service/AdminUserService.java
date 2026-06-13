package net.argeneo.iam.service;

import java.util.ArrayList;
import java.util.List;
import net.argeneo.common.error.ResourceNotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public AdminUserService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
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
