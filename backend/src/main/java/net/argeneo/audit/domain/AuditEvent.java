package net.argeneo.audit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Événement d'historique d'usage. Table PLATEFORME (NON scopée tenant) :
 * le Super-Admin consulte l'activité de tous les tenants. Volontairement
 * sans {@code @TenantId} pour échapper au filtre multi-tenant.
 */
@Entity
@Table(name = "audit_event")
@Getter
@Setter
@NoArgsConstructor
public class AuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    @Column(name = "actor_type", length = 20)
    private String actorType;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_email")
    private String actorEmail;

    @Column(name = "tenant_id")
    private Long tenantId;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(name = "target_type", length = 50)
    private String targetType;

    @Column(name = "target_id", length = 100)
    private String targetId;

    @Column(length = 500)
    private String summary;

    @PrePersist
    void onCreate() {
        if (occurredAt == null) {
            occurredAt = Instant.now();
        }
    }
}
