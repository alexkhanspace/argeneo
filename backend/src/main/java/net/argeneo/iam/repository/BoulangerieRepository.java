package net.argeneo.iam.repository;

import java.util.List;
import net.argeneo.iam.domain.Boulangerie;
import org.springframework.data.jpa.repository.JpaRepository;

/** Boulangeries du tenant courant (filtrage tenant automatique via @TenantId). */
public interface BoulangerieRepository extends JpaRepository<Boulangerie, Long> {

    List<Boulangerie> findAllByOrderByNameAsc();
}
