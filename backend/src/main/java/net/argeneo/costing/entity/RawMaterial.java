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
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import net.argeneo.costing.domain.Unit;
import org.hibernate.annotations.TenantId;

/** Matière première achetée : prix net courant (dernier prix d'achat) par unité de référence. */
@Entity
@Table(name = "raw_material")
@Getter
@Setter
@NoArgsConstructor
public class RawMaterial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "reference_unit", nullable = false, length = 10)
    private Unit referenceUnit;

    @Column(name = "price_per_unit", nullable = false, precision = 12, scale = 4)
    private BigDecimal pricePerUnit = BigDecimal.ZERO;

    /** Famille de classement (premier niveau), optionnelle. */
    @Column(name = "famille_id")
    private Long familleId;

    /** Sous-famille de classement (rattachée à {@link #familleId}), optionnelle. */
    @Column(name = "sous_famille_id")
    private Long sousFamilleId;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
