package net.argeneo.costing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/** Étape de préparation ordonnée d'une recette. */
@Entity
@Table(name = "recipe_step")
@Getter
@Setter
@NoArgsConstructor
public class RecipeStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    /** Rang d'affichage (0-based) ; le mapping côté Recipe est par @JoinColumn. */
    @Column(nullable = false)
    private Integer position;

    @Column(nullable = false, columnDefinition = "text")
    private String instruction;
}
