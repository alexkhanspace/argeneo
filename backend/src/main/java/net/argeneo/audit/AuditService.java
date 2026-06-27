package net.argeneo.audit;

import net.argeneo.audit.domain.AuditEvent;
import net.argeneo.audit.repository.AuditEventRepository;
import net.argeneo.security.AuthPrincipal;
import net.argeneo.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Journalise l'historique d'usage (logins, impersonation, mutations).
 *
 * <p>Chaque enregistrement s'exécute dans une transaction {@code REQUIRES_NEW}
 * pour que l'audit soit persisté indépendamment de la transaction métier
 * appelante (un échec d'audit ne doit pas annuler l'action, et inversement).</p>
 */
@Service
public class AuditService {

    private final AuditEventRepository repository;

    public AuditService(AuditEventRepository repository) {
        this.repository = repository;
    }

    /** Enregistre une action de l'utilisateur authentifié courant. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String action, String targetType, Object targetId, String summary) {
        AuthPrincipal actor = currentOrNull();
        AuditEvent event = new AuditEvent();
        if (actor != null) {
            event.setActorType(actor.type().name());
            event.setActorId(actor.id());
            event.setActorEmail(actor.email());
            event.setTenantId(actor.tenantId());
        }
        event.setAction(action);
        event.setTargetType(targetType);
        event.setTargetId(targetId == null ? null : String.valueOf(targetId));
        event.setSummary(summary);
        repository.save(event);
    }

    /** Enregistre un événement explicite (login : pas encore de SecurityContext). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordExplicit(String actorType, Long actorId, String actorEmail, Long tenantId,
                               String action, String summary) {
        AuditEvent event = new AuditEvent();
        event.setActorType(actorType);
        event.setActorId(actorId);
        event.setActorEmail(actorEmail);
        event.setTenantId(tenantId);
        event.setAction(action);
        event.setSummary(summary);
        repository.save(event);
    }

    private AuthPrincipal currentOrNull() {
        try {
            return CurrentUser.require();
        } catch (IllegalStateException e) {
            return null;
        }
    }
}
