package net.argeneo.costing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import net.argeneo.costing.domain.CostingSnapshots.ComponentType;
import net.argeneo.costing.domain.Unit;
import org.hibernate.annotations.TenantId;

/** Composant d'une recette : quantité d'une matière première (RAW) ou d'une sous-recette. */
@Entity
@Table(name = "recipe_component")
@Getter
@Setter
@NoArgsConstructor
public class RecipeComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "recipe_id", nullable = false)
    private Long recipeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ComponentType type;

    /** Renseigné si {@code type = RAW}. */
    @Column(name = "raw_material_id")
    private Long rawMaterialId;

    /** Renseigné si {@code type = SUBRECIPE} (id d'un article FABRIQUE). */
    @Column(name = "sub_article_id")
    private Long subArticleId;

    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Unit unit;
}
