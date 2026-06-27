package net.argeneo.costing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/** Un composant d'un article MENU : un autre article + une quantité. */
@Entity
@Table(name = "menu_item")
@Getter
@Setter
@NoArgsConstructor
public class MenuItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    /** Article MENU auquel appartient ce composant. */
    @Column(name = "menu_article_id", nullable = false)
    private Long menuArticleId;

    /** Article composant (canette, sandwich, …). */
    @Column(name = "component_article_id", nullable = false)
    private Long componentArticleId;

    @Column(nullable = false)
    private BigDecimal quantity = BigDecimal.ONE;

    @Column(nullable = false)
    private Integer position = 0;
}
