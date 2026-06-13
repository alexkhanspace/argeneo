package net.argeneo.daily.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/** Saisie quotidienne d'une etablissement : CA, perte, mot du jour. Scopé tenant. */
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

    @Column(precision = 12, scale = 2)
    private BigDecimal loss;

    @Column(name = "note_of_day", columnDefinition = "text")
    private String noteOfDay;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public DailyEntry(Long etablissementId, LocalDate entryDate) {
        this.etablissementId = etablissementId;
        this.entryDate = entryDate;
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
