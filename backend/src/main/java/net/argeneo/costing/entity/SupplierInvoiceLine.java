package net.argeneo.costing.entity;

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

/** Ligne d'une facture fournisseur (telle qu'extraite, puis éventuellement appliquée à une MP). */
@Entity
@Table(name = "supplier_invoice_line")
@Getter
@Setter
@NoArgsConstructor
public class SupplierInvoiceLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(nullable = false)
    private Integer position;

    @Column(nullable = false, length = 500)
    private String designation;

    @Column(precision = 12, scale = 3)
    private BigDecimal quantity;

    /** Unité telle que lue sur la facture (ex. « kg », « L », « sac », « pièce »). */
    @Column(length = 30)
    private String unit;

    @Column(name = "unit_price_ht", precision = 12, scale = 4)
    private BigDecimal unitPriceHt;

    @Column(name = "line_total_ht", precision = 12, scale = 2)
    private BigDecimal lineTotalHt;

    @Column(name = "vat_rate", precision = 5, scale = 4)
    private BigDecimal vatRate;

    /** MP mise à jour/créée par cette ligne lors de l'application (null tant que non appliquée). */
    @Column(name = "raw_material_id")
    private Long rawMaterialId;

    /** Prix par unité de référence effectivement appliqué à la MP. */
    @Column(name = "applied_price_per_unit", precision = 12, scale = 4)
    private BigDecimal appliedPricePerUnit;

    @Column(nullable = false)
    private boolean applied = false;

    /** Famille proposée par l'IA et créée au scan (référence souple, sans contrainte FK). */
    @Column(name = "suggested_famille_id")
    private Long suggestedFamilleId;

    @Column(name = "suggested_sous_famille_id")
    private Long suggestedSousFamilleId;
}
