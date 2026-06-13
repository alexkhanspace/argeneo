package net.argeneo.iam.repository;

import net.argeneo.iam.domain.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;

/** Tenants : table racine, non scopée (gérée par le Super-Admin). */
public interface TenantRepository extends JpaRepository<Tenant, Long> {
}
