package net.argeneo.daily.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/** Une ligne de casse/perte du jour : un article et la quantité perdue. Scopé tenant. */
@Entity
@Table(name = "daily_entry_loss")
@Getter
@Setter
@NoArgsConstructor
public class DailyEntryLoss {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    // La colonne daily_entry_id est gérée par le @JoinColumn du parent DailyEntry.

    @Column(name = "article_id", nullable = false)
    private Long articleId;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;

    public DailyEntryLoss(Long articleId, BigDecimal quantity) {
        this.articleId = articleId;
        this.quantity = quantity;
    }
}
