package net.argeneo.iam.domain;

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
import org.hibernate.annotations.TenantId;

/**
 * Attribution d'une permission à un (user, etablissement). Unité d'autorisation
 * contextualisée : un employé peut être manager ici et vendeur là. Scopé tenant.
 */
@Entity
@Table(name = "permission_grant")
@Getter
@Setter
@NoArgsConstructor
public class PermissionGrant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "etablissement_id", nullable = false)
    private Long etablissementId;

    @Column(name = "permission_code", nullable = false, length = 50)
    private String permissionCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public PermissionGrant(Long userId, Long etablissementId, String permissionCode) {
        this.userId = userId;
        this.etablissementId = etablissementId;
        this.permissionCode = permissionCode;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
