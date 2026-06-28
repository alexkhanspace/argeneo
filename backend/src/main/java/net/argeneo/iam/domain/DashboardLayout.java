package net.argeneo.iam.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Tableau de bord personnalisé d'un principal (utilisateur ou admin). Le layout (positions +
 * widgets) est stocké tel quel en JSON. Volontairement SANS @TenantId : c'est une préférence
 * par compte, qui doit fonctionner aussi pour le Super-Admin (sans tenant).
 */
@Entity
@Table(name = "dashboard_layout")
@Getter
@Setter
@NoArgsConstructor
public class DashboardLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "principal_id", nullable = false)
    private Long principalId;

    @Column(name = "principal_type", nullable = false, length = 10)
    private String principalType;

    /** Configuration du dashboard (JSON : widgets + positions), telle qu'envoyée par le front. */
    @Column(columnDefinition = "text")
    private String layout;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
