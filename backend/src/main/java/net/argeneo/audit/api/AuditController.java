package net.argeneo.audit.api;

import java.util.List;
import net.argeneo.audit.AuditQueryService;
import net.argeneo.audit.api.dto.AuditDtos.AuditEventResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Historique d'usage de la plateforme — réservé Super-Admin (cf. /api/admin/**). */
@RestController
@RequestMapping("/api/admin/audit")
public class AuditController {

    private final AuditQueryService auditQueryService;

    public AuditController(AuditQueryService auditQueryService) {
        this.auditQueryService = auditQueryService;
    }

    @GetMapping
    public List<AuditEventResponse> list(@RequestParam(required = false) Long tenantId,
                                         @RequestParam(defaultValue = "200") int limit) {
        return auditQueryService.recent(tenantId, limit);
    }
}
