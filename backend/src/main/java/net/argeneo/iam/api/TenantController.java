package net.argeneo.iam.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.iam.api.dto.EtablissementDtos.CreateEtablissementRequest;
import net.argeneo.iam.api.dto.EtablissementDtos.EtablissementResponse;
import net.argeneo.iam.api.dto.TenantDtos.CreateTenantRequest;
import net.argeneo.iam.api.dto.TenantDtos.TenantResponse;
import net.argeneo.iam.service.ImpersonationService;
import net.argeneo.iam.service.TenantService;
import net.argeneo.security.AuthDtos.LoginResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Parcours Super-Admin : gestion des tenants (protégé par hasRole SUPER_ADMIN). */
@RestController
@RequestMapping("/api/admin/tenants")
public class TenantController {

    private final TenantService tenantService;
    private final ImpersonationService impersonationService;

    public TenantController(TenantService tenantService,
                            ImpersonationService impersonationService) {
        this.tenantService = tenantService;
        this.impersonationService = impersonationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TenantResponse create(@Valid @RequestBody CreateTenantRequest request) {
        return tenantService.createTenant(request);
    }

    @GetMapping
    public List<TenantResponse> list() {
        return tenantService.listTenants();
    }

    // --- Établissements d'un tenant (création à la souscription) ---

    @PostMapping("/{tenantId}/etablissements")
    @ResponseStatus(HttpStatus.CREATED)
    public EtablissementResponse addEtablissement(@PathVariable Long tenantId,
                                                  @Valid @RequestBody CreateEtablissementRequest request) {
        return tenantService.addEtablissement(tenantId, request);
    }

    @GetMapping("/{tenantId}/etablissements")
    public List<EtablissementResponse> listEtablissements(@PathVariable Long tenantId) {
        return tenantService.listEtablissements(tenantId);
    }

    /** Mode support : obtenir un jeton « Patron » pour agir dans ce tenant. */
    @PostMapping("/{tenantId}/impersonate")
    public LoginResponse impersonate(@PathVariable Long tenantId) {
        return impersonationService.impersonatePatron(tenantId);
    }
}
