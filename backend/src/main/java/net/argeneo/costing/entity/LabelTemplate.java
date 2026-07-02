package net.argeneo.costing.entity;

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
import org.hibernate.annotations.TenantId;

/**
 * Modèle d'étiquette réutilisable : porte la mise en forme (couleurs, taille, cadre, craie…)
 * ET ses badges (Kasher, Vegan, Halal…). Un modèle s'affecte à un article via
 * {@link Article#getLabelTemplateId()}. Les badges sont sérialisés en JSON.
 */
@Entity
@Table(name = "label_template")
@Getter
@Setter
@NoArgsConstructor
public class LabelTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(nullable = false, length = 120)
    private String name;

    /** Nom d'enseigne affiché en pied d'étiquette (optionnel). */
    @Column(length = 120)
    private String brand;

    @Column(name = "bg_color", nullable = false, length = 20)
    private String bgColor = "#ffffff";

    @Column(name = "text_color", nullable = false, length = 20)
    private String textColor = "#111111";

    @Column(name = "border_color", nullable = false, length = 20)
    private String borderColor = "#111111";

    @Column(name = "width_cm", nullable = false)
    private double widthCm = 10;

    @Column(name = "height_cm", nullable = false)
    private double heightCm = 6;

    @Column(name = "font_scale", nullable = false)
    private double fontScale = 1;

    @Column(name = "show_price", nullable = false)
    private boolean showPrice = true;

    /** Cadre décoratif : « none » ou « wood ». */
    @Column(nullable = false, length = 10)
    private String frame = "none";

    /** Police manuscrite type craie (rendu ardoise). */
    @Column(nullable = false)
    private boolean chalk = false;

    /** Agrandir les étiquettes pour remplir l'A4 (moins de perte). */
    @Column(name = "fill_sheet", nullable = false)
    private boolean fillSheet = false;

    /** Position des badges : « tr », « tl » ou « footer ». */
    @Column(name = "badge_pos", nullable = false, length = 10)
    private String badgePos = "tr";

    @Column(name = "badge_scale", nullable = false)
    private double badgeScale = 1;

    /** Texte libre (allergènes, promo…) commun aux étiquettes de ce modèle. */
    @Column(name = "extra_text", columnDefinition = "text")
    private String extraText;

    /** Reprend la description du produit (ingrédients) sur l'étiquette. */
    @Column(name = "use_description", nullable = false)
    private boolean useDescription = false;

    /** Badges du modèle, sérialisés en JSON (liste de { text, color } ou { img }). */
    @Column(columnDefinition = "text")
    private String badges;

    /**
     * Modèle par défaut de l'enseigne : appliqué aux produits sans modèle propre lors de
     * l'impression. Au plus un par tenant (index unique partiel côté BDD).
     */
    @Column(name = "is_default", nullable = false)
    private boolean enseigneDefault = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
