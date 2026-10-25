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

/** Produit d'un cadencier (référence fournisseur, désignation, conditionnement, prix indicatif). */
@Entity
@Table(name = "order_sheet_line")
@Getter
@Setter
@NoArgsConstructor
public class OrderSheetLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(nullable = false)
    private Integer position;

    /** Rubrique optionnelle (ex. « Surgelés », « Fournitures ») pour regrouper l'affichage. */
    @Column(length = 120)
    private String section;

    /** Code article du fournisseur. */
    @Column(length = 60)
    private String code;

    @Column(nullable = false, length = 300)
    private String designation;

    /** Désignation secondaire (ex. libellé allemand du fournisseur). */
    @Column(name = "designation_alt", length = 300)
    private String designationAlt;

    /** Conditionnement (ex. « 4 x 2,5 kg », « Sac », « Palette »). */
    @Column(length = 120)
    private String packaging;

    @Column(name = "unit_price", precision = 12, scale = 4)
    private BigDecimal unitPrice;

    /** Unité du prix (ex. « kg », « colis », « pièce »). */
    @Column(name = "price_unit", length = 30)
    private String priceUnit;

    /** Matière première associée (optionnelle). */
    @Column(name = "raw_material_id")
    private Long rawMaterialId;
}
