package net.argeneo.communication.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/** Publication de communication archivée (brief, légende, réglages et visuel composé). */
@Entity
@Table(name = "communication")
@Getter
@Setter
@NoArgsConstructor
public class Communication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "etablissement_id")
    private Long etablissementId;

    @Column(columnDefinition = "text")
    private String brief;

    @Column(length = 30)
    private String platform;

    @Column(length = 30)
    private String tone;

    @Column(length = 20)
    private String length;

    @Column(length = 120)
    private String ambiance;

    @Column(columnDefinition = "text")
    private String instruction;

    @Column(length = 200)
    private String headline;

    @Column(columnDefinition = "text")
    private String caption;

    /** Produit éventuellement mis en avant. */
    @Column(name = "article_id")
    private Long articleId;

    /** Visuel composé, stocké sur disque (UUID). */
    @Column(name = "image_file", length = 120)
    private String imageFile;

    @Column(name = "image_mime", length = 100)
    private String imageMime;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
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
