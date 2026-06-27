package net.argeneo.iam.service;

import net.argeneo.audit.AuditService;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.iam.domain.AppUser;
import net.argeneo.iam.domain.Tenant;
import net.argeneo.iam.domain.UserRole;
import net.argeneo.iam.repository.AppUserRepository;
import net.argeneo.iam.repository.TenantRepository;
import net.argeneo.security.AuthDtos.LoginResponse;
import net.argeneo.security.AuthPrincipal;
import net.argeneo.security.CurrentUser;
import net.argeneo.security.JwtService;
import net.argeneo.security.PrincipalType;
import net.argeneo.tenant.TenantContext;
import org.springframework.stereotype.Service;

/**
 * Mode support : un Super-Admin obtient un jeton l'autorisant à agir comme le
 * Patron d'un tenant. Le jeton conserve l'id de l'admin (claim d'audit) pour
 * tracer l'accès et permettre l'affichage d'une bannière côté UI.
 */
@Service
public class ImpersonationService {

    private final TenantRepository tenantRepository;
    private final AppUserRepository userRepository;
    private final JwtService jwtService;
    private final AuditService audit;

    public ImpersonationService(TenantRepository tenantRepository,
                                AppUserRepository userRepository,
                                JwtService jwtService,
                                AuditService audit) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.audit = audit;
    }

    /** Délivre un jeton « Patron » du tenant, signé pour le Super-Admin courant. */
    public LoginResponse impersonatePatron(Long tenantId) {
        // Tenant existant et actif : on refuse l'accès à un tenant archivé.
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant introuvable : " + tenantId));
        if (!tenant.isActive()) {
            throw new ResourceNotFoundException("Tenant archivé : impossible d'y accéder");
        }
        Long adminId = CurrentUser.require().id();

        AppUser patron = TenantContext.runAs(tenantId, () ->
                userRepository.findAllByRoleOrderByFullNameAsc(UserRole.PATRON)
                        .stream().findFirst().orElse(null));
        if (patron == null) {
            throw new ResourceNotFoundException("Aucun patron pour le tenant " + tenantId);
        }

        AuthPrincipal principal = new AuthPrincipal(
                patron.getId(), patron.getEmail(), patron.getFullName(),
                PrincipalType.USER, UserRole.PATRON, tenantId, adminId);

        // Traçabilité : le SecurityContext courant est le Super-Admin déclencheur.
        audit.record("IMPERSONATE_START", "TENANT", tenantId,
                "Accès support au tenant " + tenant.getName());

        return new LoginResponse(
                jwtService.generate(principal),
                jwtService.expirationSeconds(),
                patron.getEmail(),
                patron.getFullName(),
                PrincipalType.USER.name(),
                UserRole.PATRON.name(),
                tenantId);
    }
}
