package net.argeneo.iam.service;

import java.util.List;
import net.argeneo.iam.api.dto.TenantDtos.CreateTenantRequest;
import net.argeneo.iam.api.dto.TenantDtos.TenantResponse;
import net.argeneo.iam.domain.RecipeScope;
import net.argeneo.iam.domain.Tenant;
import net.argeneo.iam.repository.TenantRepository;
import net.argeneo.tenant.TenantContext;
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

    public TenantService(TenantRepository tenantRepository, UserService userService) {
        this.tenantRepository = tenantRepository;
        this.userService = userService;
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
}
