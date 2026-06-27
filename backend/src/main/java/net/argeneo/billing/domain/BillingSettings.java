package net.argeneo.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Paramètres & mentions de facturation. 1-1 avec l'établissement (déjà scopé
 * tenant) ; non scopé tenant.
 */
@Entity
@Table(name = "billing_settings")
@Getter
@Setter
@NoArgsConstructor
public class BillingSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "etablissement_id", nullable = false, updatable = false)
    private Long etablissementId;

    @Column(name = "legal_mentions", columnDefinition = "text")
    private String legalMentions;

    @Column(name = "payment_terms_days")
    private Integer paymentTermsDays;

    @Column(name = "late_penalty", columnDefinition = "text")
    private String latePenalty;

    @Column(columnDefinition = "text")
    private String footer;

    @Column(name = "brand_color1", length = 7)
    private String brandColor1;

    @Column(name = "brand_color2", length = 7)
    private String brandColor2;

    @Column(name = "brand_color3", length = 7)
    private String brandColor3;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
