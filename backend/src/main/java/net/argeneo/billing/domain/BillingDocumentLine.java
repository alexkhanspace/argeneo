package net.argeneo.billing.domain;

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

/** Une ligne d'un document de facturation (devis ou facture). Scopé tenant. */
@Entity
@Table(name = "billing_document_line")
@Getter
@Setter
@NoArgsConstructor
public class BillingDocumentLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    // La colonne document_id est gérée par le @JoinColumn du parent BillingDocument.

    @Column(name = "position", nullable = false)
    private Integer position;

    @Column(nullable = false, length = 500)
    private String designation;

    @Column(name = "article_id")
    private Long articleId;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity = BigDecimal.ONE;

    @Column(length = 20)
    private String unit;

    @Column(name = "unit_price_ht", nullable = false, precision = 12, scale = 4)
    private BigDecimal unitPriceHt = BigDecimal.ZERO;

    @Column(name = "vat_rate", nullable = false, precision = 5, scale = 4)
    private BigDecimal vatRate = BigDecimal.ZERO;

    @Column(name = "discount_rate", nullable = false, precision = 5, scale = 4)
    private BigDecimal discountRate = BigDecimal.ZERO;

    @Column(name = "line_total_ht", nullable = false, precision = 12, scale = 2)
    private BigDecimal lineTotalHt = BigDecimal.ZERO;
}
