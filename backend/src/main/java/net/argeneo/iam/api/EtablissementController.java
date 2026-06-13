package net.argeneo.iam.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.iam.api.dto.EtablissementDtos.EtablissementResponse;
import net.argeneo.iam.api.dto.EtablissementDtos.CreateEtablissementRequest;
import net.argeneo.iam.service.EtablissementService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Parcours Patron : gestion des etablissements de son tenant. */
@RestController
@RequestMapping("/api/etablissements")
@PreAuthorize("hasRole('PATRON')")
public class EtablissementController {

    private final EtablissementService etablissementService;

    public EtablissementController(EtablissementService etablissementService) {
        this.etablissementService = etablissementService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EtablissementResponse create(@Valid @RequestBody CreateEtablissementRequest request) {
        return etablissementService.create(request);
    }

    @GetMapping
    public List<EtablissementResponse> list() {
        return etablissementService.list();
    }
}
