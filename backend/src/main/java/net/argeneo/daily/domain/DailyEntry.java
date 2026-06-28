package net.argeneo.daily.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

/**
 * Saisie quotidienne d'une etablissement : CA global, casse par article,
 * mots du jour (production et vente). Scopé tenant.
 */
@Entity
@Table(name = "daily_entry")
@Getter
@Setter
@NoArgsConstructor
public class DailyEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "etablissement_id", nullable = false, updatable = false)
    private Long etablissementId;

    @Column(name = "entry_date", nullable = false, updatable = false)
    private LocalDate entryDate;

    @Column(precision = 12, scale = 2)
    private BigDecimal revenue;

    /** Nombre de clients du jour (fréquentation) — sert au ticket moyen. */
    @Column(name = "client_count")
    private Integer clientCount;

    /** Casse du jour, détaillée par article. */
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "daily_entry_id", nullable = false)
    private List<DailyEntryLoss> losses = new ArrayList<>();

    /** Perte du jour en valeur (€), saisie globale simple (sans détail article). */
    @Column(name = "loss_amount", precision = 12, scale = 2)
    private BigDecimal lossAmount;

    @Column(name = "note_prod", columnDefinition = "text")
    private String noteProd;

    @Column(name = "note_sale", columnDefinition = "text")
    private String noteSale;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public DailyEntry(Long etablissementId, LocalDate entryDate) {
        this.etablissementId = etablissementId;
        this.entryDate = entryDate;
    }

    /** Remplace toutes les lignes de casse (orphanRemoval supprime les anciennes). */
    public void replaceLosses(List<DailyEntryLoss> newLosses) {
        this.losses.clear();
        if (newLosses != null) {
            this.losses.addAll(newLosses);
        }
    }

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
