package net.argeneo.iam.repository;

import net.argeneo.iam.domain.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

/** Catalogue des permissions atomiques (référence globale). */
public interface PermissionRepository extends JpaRepository<Permission, String> {

    java.util.List<Permission> findAllByOrderByCategoryAscCodeAsc();
}
