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

/** Article vendable : acheté-revendu ou fabriqué. */
@Entity
@Table(name = "article")
@Getter
@Setter
@NoArgsConstructor
public class Article {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ArticleType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Unit unit;

    /** Prix de vente TTC (prix client). Le HT s'en déduit via {@link #vatRate}. */
    @Column(name = "sale_price_ttc", precision = 12, scale = 4)
    private BigDecimal salePriceTtc;

    @Column(name = "vat_rate", precision = 5, scale = 4)
    private BigDecimal vatRate;

    /** Prix d'achat pour les articles ACHAT_REVENTE (= PNET). */
    @Column(name = "purchase_price", precision = 12, scale = 4)
    private BigDecimal purchasePrice;

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
