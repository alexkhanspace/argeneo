package net.argeneo.costing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import net.argeneo.costing.domain.Unit;
import org.hibernate.annotations.TenantId;

/** Recette d'un article fabriqué : rendement, taux de perte, méthode, durée. */
@Entity
@Table(name = "recipe")
@Getter
@Setter
@NoArgsConstructor
public class Recipe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "article_id", nullable = false)
    private Long articleId;

    @Column(name = "yield_quantity", nullable = false, precision = 12, scale = 4)
    private BigDecimal yieldQuantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "yield_unit", nullable = false, length = 10)
    private Unit yieldUnit;

    @Column(name = "loss_rate", nullable = false, precision = 5, scale = 4)
    private BigDecimal lossRate = BigDecimal.ZERO;

    @Column(columnDefinition = "text")
    private String method;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    /** Étapes de préparation ordonnées (gérées par cascade depuis la recette).
     *  nullable=false : Hibernate inclut recipe_id dans l'INSERT (sinon insert null + update → NOT NULL violé). */
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "recipe_id", nullable = false)
    @OrderBy("position ASC")
    private List<RecipeStep> steps = new ArrayList<>();
}
