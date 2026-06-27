package net.argeneo.billing.domain;

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
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
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

/** Document de facturation : devis ou facture, avec ses lignes. Scopé tenant. */
@Entity
@Table(name = "billing_document")
@Getter
@Setter
@NoArgsConstructor
public class BillingDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "etablissement_id", nullable = false, updatable = false)
    private Long etablissementId;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private DocumentType type;

    /** Numéro du document : null tant que le document est en brouillon. */
    @Column(length = 50)
    private String number;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentStatus status = DocumentStatus.BROUILLON;

    @Column(name = "issue_date")
    private LocalDate issueDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(nullable = false, length = 3)
    private String currency = "EUR";

    @Column(name = "total_ht", precision = 12, scale = 2)
    private BigDecimal totalHt = BigDecimal.ZERO;

    @Column(name = "total_vat", precision = 12, scale = 2)
    private BigDecimal totalVat = BigDecimal.ZERO;

    @Column(name = "total_ttc", precision = 12, scale = 2)
    private BigDecimal totalTtc = BigDecimal.ZERO;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(columnDefinition = "text")
    private String terms;

    /** Lignes du document (la colonne document_id est portée par le @JoinColumn). */
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "document_id", nullable = false)
    private List<BillingDocumentLine> lines = new ArrayList<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
