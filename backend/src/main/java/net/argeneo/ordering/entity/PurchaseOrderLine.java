package net.argeneo.ordering.entity;

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

/** Ligne commandée (copie du produit du cadencier + quantité). */
@Entity
@Table(name = "purchase_order_line")
@Getter
@Setter
@NoArgsConstructor
public class PurchaseOrderLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "sheet_line_id")
    private Long sheetLineId;

    @Column(nullable = false)
    private Integer position;

    @Column(length = 120)
    private String section;

    @Column(length = 60)
    private String code;

    @Column(nullable = false, length = 300)
    private String designation;

    @Column(length = 120)
    private String packaging;

    @Column(name = "unit_price", precision = 12, scale = 4)
    private BigDecimal unitPrice;

    @Column(name = "price_unit", length = 30)
    private String priceUnit;

    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;
}
