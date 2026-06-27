package net.argeneo.audit;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import net.argeneo.audit.api.dto.AuditDtos.AuditEventResponse;
import net.argeneo.audit.domain.AuditEvent;
import net.argeneo.audit.repository.AuditEventRepository;
import net.argeneo.iam.domain.Tenant;
import net.argeneo.iam.repository.TenantRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lecture de l'historique d'usage (Super-Admin), enrichie du nom de tenant. */
@Service
public class AuditQueryService {

    private final AuditEventRepository repository;
    private final TenantRepository tenantRepository;

    public AuditQueryService(AuditEventRepository repository, TenantRepository tenantRepository) {
        this.repository = repository;
        this.tenantRepository = tenantRepository;
    }

    @Transactional(readOnly = true)
    public List<AuditEventResponse> recent(Long tenantId, int limit) {
        int capped = Math.min(Math.max(limit, 1), 1000);
        PageRequest page = PageRequest.of(0, capped);
        List<AuditEvent> events = tenantId == null
                ? repository.findByOrderByOccurredAtDesc(page)
                : repository.findByTenantIdOrderByOccurredAtDesc(tenantId, page);

        Map<Long, String> namesById = tenantRepository.findAll().stream()
                .collect(Collectors.toMap(Tenant::getId, Tenant::getName, (a, b) -> a));

        return events.stream()
                .map(e -> AuditEventResponse.from(e,
                        e.getTenantId() == null ? null : namesById.get(e.getTenantId())))
                .toList();
    }
}
