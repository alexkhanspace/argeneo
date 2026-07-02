package net.argeneo.costing.repository;

import java.util.List;
import net.argeneo.costing.entity.LabelTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

/** Référentiel des modèles d'étiquette (scopé tenant via @TenantId). */
public interface LabelTemplateRepository extends JpaRepository<LabelTemplate, Long> {

    List<LabelTemplate> findAllByOrderByNameAsc();
}
