package net.argeneo.iam.service;

import java.util.List;
import net.argeneo.audit.AuditService;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.iam.api.dto.EtablissementDtos.CreateEtablissementRequest;
import net.argeneo.iam.api.dto.EtablissementDtos.EtablissementResponse;
import net.argeneo.iam.api.dto.EtablissementDtos.UpdateEtablissementRequest;
import net.argeneo.iam.api.dto.TenantDtos.CreateTenantRequest;
import net.argeneo.iam.api.dto.TenantDtos.TenantResponse;
import net.argeneo.iam.api.dto.TenantDtos.UpdateTenantRequest;
import net.argeneo.iam.domain.RecipeScope;
import net.argeneo.iam.domain.Tenant;
import net.argeneo.iam.repository.TenantRepository;
import net.argeneo.tenant.TenantContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Parcours Super-Admin : création/gestion des tenants.
 *
 * <p>La création n'est volontairement PAS transactionnelle au niveau de la
 * méthode : le tenant (table racine) et son patron (scopé tenant) sont persistés
 * dans deux transactions distinctes, car Hibernate fige le tenant d'une session
 * à son ouverture. Le patron est créé via {@link TenantContext#runAs} pour que
 * sa session résolve le tenant fraîchement créé.</p>
 */
@Service
public class TenantService {

    private final TenantRepository tenantRepository;
    private final UserService userService;
    private final EtablissementService etablissementService;
    private final AuditService audit;
    private final JdbcTemplate jdbc;

    public TenantService(TenantRepository tenantRepository,
                         UserService userService,
                         EtablissementService etablissementService,
                         AuditService audit,
                         JdbcTemplate jdbc) {
        this.tenantRepository = tenantRepository;
        this.userService = userService;
        this.etablissementService = etablissementService;
        this.audit = audit;
        this.jdbc = jdbc;
    }

    public TenantResponse createTenant(CreateTenantRequest request) {
        Tenant tenant = saveTenant(request);
        TenantContext.runAs(tenant.getId(), () ->
                userService.createPatron(request.patronEmail(), request.patronPassword(),
                        request.patronFullName()));
        return TenantResponse.from(tenant);
    }

    // Transaction propre à repository.save : le tenant est committé immédiatement,
    // donc visible (FK) par la transaction de création du patron qui suit.
    private Tenant saveTenant(CreateTenantRequest request) {
        Tenant tenant = new Tenant();
        tenant.setName(request.name());
        tenant.setRecipeScope(request.recipeScope() == null ? RecipeScope.ENSEIGNE : request.recipeScope());
        return tenantRepository.save(tenant);
    }

    @Transactional(readOnly = true)
    public List<TenantResponse> listTenants() {
        return tenantRepository.findAll().stream().map(TenantResponse::from).toList();
    }

    /** Met à jour le nom et la portée des recettes d'un tenant. */
    @Transactional
    public TenantResponse updateTenant(Long id, UpdateTenantRequest req) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant introuvable : " + id));
        tenant.setName(req.name());
        tenant.setRecipeScope(req.recipeScope() == null
                ? (tenant.getRecipeScope() == null ? RecipeScope.ENSEIGNE : tenant.getRecipeScope())
                : req.recipeScope());
        tenantRepository.save(tenant);
        audit.record("TENANT_UPDATE", "TENANT", id, "Enseigne " + req.name());
        return TenantResponse.from(tenant);
    }

    /**
     * Archive un tenant : le désactive ET coupe la connexion de tous ses
     * utilisateurs. La désactivation des users passe par {@link JdbcTemplate}
     * (hors filtre {@code @TenantId}), seul chemin cross-tenant admis ici.
     */
    @Transactional
    public TenantResponse archiveTenant(Long id) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant introuvable : " + id));
        tenant.setActive(false);
        tenantRepository.save(tenant);
        jdbc.update("UPDATE app_user SET active = false WHERE tenant_id = ?", id);
        audit.record("TENANT_ARCHIVE", "TENANT", id, "Archivage de " + tenant.getName());
        return TenantResponse.from(tenant);
    }

    /** Réactive un tenant et rouvre l'accès à l'ensemble de ses utilisateurs. */
    @Transactional
    public TenantResponse restoreTenant(Long id) {
        Tenant tenant = tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant introuvable : " + id));
        tenant.setActive(true);
        tenantRepository.save(tenant);
        jdbc.update("UPDATE app_user SET active = true WHERE tenant_id = ?", id);
        audit.record("TENANT_RESTORE", "TENANT", id, "Réactivation de " + tenant.getName());
        return TenantResponse.from(tenant);
    }

    // --- Établissements d'un tenant (réservé Super-Admin : souscription/licence) ---
    // Pas de @Transactional ici : on laisse EtablissementService ouvrir sa session
    // APRÈS que runAs ait positionné le tenant (cf. note sur Hibernate ci-dessus).

    public EtablissementResponse addEtablissement(Long tenantId, CreateEtablissementRequest request) {
        requireTenant(tenantId);
        EtablissementResponse created = TenantContext.runAs(tenantId,
                () -> etablissementService.create(request));
        audit.record("ETABLISSEMENT_CREATE", "ETABLISSEMENT", created.id(),
                "Établissement « " + created.name() + " »");
        return created;
    }

    public EtablissementResponse updateEtablissement(Long tenantId, Long etablissementId,
                                                     UpdateEtablissementRequest request) {
        requireTenant(tenantId);
        EtablissementResponse updated = TenantContext.runAs(tenantId,
                () -> etablissementService.update(etablissementId, request));
        audit.record("ETABLISSEMENT_UPDATE", "ETABLISSEMENT", etablissementId,
                "Établissement « " + updated.name() + " »");
        return updated;
    }

    public List<EtablissementResponse> listEtablissements(Long tenantId) {
        requireTenant(tenantId);
        return TenantContext.runAs(tenantId, etablissementService::list);
    }

    private void requireTenant(Long tenantId) {
        if (!tenantRepository.existsById(tenantId)) {
            throw new ResourceNotFoundException("Tenant introuvable : " + tenantId);
        }
    }
}
