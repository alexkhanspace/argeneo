package net.argeneo.costing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * Famille de classement, auto-référencée : {@code parentId == null} = famille de premier niveau,
 * sinon sous-famille rattachée à cette famille. Le {@link FamilleScope} sépare les arborescences
 * des produits et des matières premières.
 */
@Entity
@Table(name = "famille")
@Getter
@Setter
@NoArgsConstructor
public class Famille {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private FamilleScope scope;

    /** Famille parente : {@code null} pour une famille, renseignée pour une sous-famille. */
    @Column(name = "parent_id")
    private Long parentId;

    @Column(nullable = false, length = 120)
    private String name;

    /** Ordre d'affichage au sein d'un même niveau. */
    @Column(nullable = false)
    private Integer position = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
