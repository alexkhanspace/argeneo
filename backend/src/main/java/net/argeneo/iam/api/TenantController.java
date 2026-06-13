package net.argeneo.iam.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.iam.api.dto.TenantDtos.CreateTenantRequest;
import net.argeneo.iam.api.dto.TenantDtos.TenantResponse;
import net.argeneo.iam.service.TenantService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
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

    public TenantController(TenantService tenantService) {
        this.tenantService = tenantService;
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
}
