package net.argeneo.audit.repository;

import java.util.List;
import net.argeneo.audit.domain.AuditEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/** Historique d'usage (table plateforme, non scopée tenant). */
public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

    List<AuditEvent> findByOrderByOccurredAtDesc(Pageable pageable);

    List<AuditEvent> findByTenantIdOrderByOccurredAtDesc(Long tenantId, Pageable pageable);
}
