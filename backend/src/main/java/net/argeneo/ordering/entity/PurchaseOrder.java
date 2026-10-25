package net.argeneo.ordering.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/**
 * Commande fournisseur passée depuis un cadencier pour un établissement. Les lignes sont des
 * copies (désignation, prix…) pour que l'historique ne change pas si le cadencier évolue.
 */
@Entity
@Table(name = "purchase_order")
@Getter
@Setter
@NoArgsConstructor
public class PurchaseOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "sheet_id")
    private Long sheetId;

    @Column(name = "sheet_name", nullable = false, length = 150)
    private String sheetName;

    @Column(name = "supplier_name", length = 255)
    private String supplierName;

    @Column(name = "etablissement_id")
    private Long etablissementId;

    @Column(name = "order_date", nullable = false)
    private LocalDate orderDate;

    @Column(name = "delivery_date")
    private LocalDate deliveryDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PurchaseOrderStatus status = PurchaseOrderStatus.BROUILLON;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_by_id")
    private Long createdById;

    @Column(name = "created_by_name", length = 255)
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "validated_at")
    private Instant validatedAt;

    @Column(name = "received_at")
    private Instant receivedAt;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "order_id", nullable = false)
    @OrderBy("position ASC")
    private List<PurchaseOrderLine> lines = new ArrayList<>();

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
