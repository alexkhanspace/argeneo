package net.argeneo.audit.api.dto;

import java.time.Instant;
import net.argeneo.audit.domain.AuditEvent;

/** DTOs de l'historique d'usage (consultation Super-Admin). */
public final class AuditDtos {

    private AuditDtos() {
    }

    public record AuditEventResponse(
            Long id,
            Instant occurredAt,
            String actorType,
            String actorEmail,
            Long tenantId,
            String tenantName,
            String action,
            String targetType,
            String targetId,
            String summary) {

        public static AuditEventResponse from(AuditEvent e, String tenantName) {
            return new AuditEventResponse(
                    e.getId(), e.getOccurredAt(), e.getActorType(), e.getActorEmail(),
                    e.getTenantId(), tenantName, e.getAction(), e.getTargetType(),
                    e.getTargetId(), e.getSummary());
        }
    }
}
