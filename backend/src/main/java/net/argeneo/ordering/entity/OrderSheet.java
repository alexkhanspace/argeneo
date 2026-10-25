package net.argeneo.ordering.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/** Cadencier : modèle de bon de commande d'un fournisseur (liste ordonnée des produits commandables). */
@Entity
@Table(name = "order_sheet")
@Getter
@Setter
@NoArgsConstructor
public class OrderSheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "supplier_name", length = 255)
    private String supplierName;

    @Column(name = "supplier_email", length = 255)
    private String supplierEmail;

    @Column(name = "supplier_phone", length = 50)
    private String supplierPhone;

    @Column(columnDefinition = "text")
    private String notes;

    /** Couleur du bon de commande imprimé (#RRGGBB). */
    @Column(length = 9)
    private String color;

    @Column(name = "show_prices", nullable = false)
    private boolean showPrices = true;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "sheet_id", nullable = false)
    @OrderBy("position ASC")
    private List<OrderSheetLine> lines = new ArrayList<>();

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
