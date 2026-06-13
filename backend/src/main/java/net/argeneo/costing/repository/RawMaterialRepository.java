package net.argeneo.costing.repository;

import java.util.List;
import net.argeneo.costing.entity.RawMaterial;
import org.springframework.data.jpa.repository.JpaRepository;

/** Matières premières du tenant courant (filtrage tenant automatique). */
public interface RawMaterialRepository extends JpaRepository<RawMaterial, Long> {

    List<RawMaterial> findAllByOrderByNameAsc();
}
