package net.argeneo.iam.repository;

import java.util.List;
import net.argeneo.iam.domain.Etablissement;
import org.springframework.data.jpa.repository.JpaRepository;

/** Etablissements du tenant courant (filtrage tenant automatique via @TenantId). */
public interface EtablissementRepository extends JpaRepository<Etablissement, Long> {

    List<Etablissement> findAllByOrderByNameAsc();
}
