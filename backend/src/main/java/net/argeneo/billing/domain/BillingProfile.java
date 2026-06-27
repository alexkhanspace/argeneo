package net.argeneo.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Émetteur des documents de facturation : identité légale & coordonnées
 * bancaires. 1-1 avec l'établissement (déjà scopé tenant) ; non scopé tenant.
 */
@Entity
@Table(name = "billing_profile")
@Getter
@Setter
@NoArgsConstructor
public class BillingProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "etablissement_id", nullable = false, updatable = false)
    private Long etablissementId;

    @Column(length = 9)
    private String siren;

    @Column(length = 14)
    private String siret;

    @Column(name = "tva_intra", length = 20)
    private String tvaIntra;

    @Column(length = 100)
    private String rcs;

    @Column(length = 10)
    private String ape;

    @Column(name = "legal_form", length = 100)
    private String legalForm;

    @Column(name = "share_capital", precision = 14, scale = 2)
    private BigDecimal shareCapital;

    @Column(length = 34)
    private String iban;

    @Column(length = 11)
    private String bic;

    @Column(name = "contact_email", length = 255)
    private String contactEmail;

    @Column(name = "contact_phone", length = 30)
    private String contactPhone;

    /** Nom du fichier logo uploadé (servi via /api/media/{file}). */
    @Column(name = "logo_file", length = 120)
    private String logoFile;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
