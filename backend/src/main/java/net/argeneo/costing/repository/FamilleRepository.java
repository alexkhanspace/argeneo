package net.argeneo.costing.repository;

import java.util.List;
import java.util.Optional;
import net.argeneo.costing.entity.Famille;
import net.argeneo.costing.entity.FamilleScope;
import org.springframework.data.jpa.repository.JpaRepository;

/** Référentiel des familles/sous-familles (scopé tenant via @TenantId). */
public interface FamilleRepository extends JpaRepository<Famille, Long> {

    List<Famille> findByScopeOrderByPositionAscNameAsc(FamilleScope scope);

    Optional<Famille> findByIdAndScope(Long id, FamilleScope scope);

    boolean existsByParentId(Long parentId);
}
