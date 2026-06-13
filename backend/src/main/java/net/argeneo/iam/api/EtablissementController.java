package net.argeneo.iam.api;

import java.util.List;
import net.argeneo.iam.api.dto.EtablissementDtos.EtablissementResponse;
import net.argeneo.iam.service.EtablissementService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Parcours Patron : consultation de ses établissements.
 *
 * <p>La <b>création</b> d'établissements relève du Super-Admin (souscription /
 * licence) — voir {@code /api/admin/tenants/{id}/etablissements}.</p>
 */
@RestController
@RequestMapping("/api/etablissements")
@PreAuthorize("hasRole('PATRON')")
public class EtablissementController {

    private final EtablissementService etablissementService;

    public EtablissementController(EtablissementService etablissementService) {
        this.etablissementService = etablissementService;
    }

    @GetMapping
    public List<EtablissementResponse> list() {
        return etablissementService.list();
    }
}
