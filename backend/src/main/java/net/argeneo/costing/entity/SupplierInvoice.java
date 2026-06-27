package net.argeneo.costing.entity;

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
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/**
 * Facture fournisseur scannée (archivée pour la compta). Les lignes extraites par l'IA
 * servent à mettre à jour les prix des matières premières après revue du patron.
 */
@Entity
@Table(name = "supplier_invoice")
@Getter
@Setter
@NoArgsConstructor
public class SupplierInvoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    /** Établissement concerné (tag optionnel pour la compta ; les MP restent globales). */
    @Column(name = "etablissement_id")
    private Long etablissementId;

    @Column(name = "supplier_name", length = 255)
    private String supplierName;

    @Column(name = "invoice_number", length = 100)
    private String invoiceNumber;

    @Column(name = "invoice_date")
    private LocalDate invoiceDate;

    @Column(name = "total_ht", precision = 12, scale = 2)
    private BigDecimal totalHt;

    @Column(name = "total_vat", precision = 12, scale = 2)
    private BigDecimal totalVat;

    @Column(name = "total_ttc", precision = 12, scale = 2)
    private BigDecimal totalTtc;

    /** Nom du fichier scanné stocké sur disque (UUID). */
    @Column(name = "scan_file", length = 120)
    private String scanFile;

    @Column(name = "scan_mime", length = 100)
    private String scanMime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SupplierInvoiceStatus status = SupplierInvoiceStatus.NOUVEAU;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "applied_at")
    private Instant appliedAt;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "invoice_id", nullable = false)
    @OrderBy("position ASC")
    private List<SupplierInvoiceLine> lines = new ArrayList<>();

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
