package net.argeneo.costing.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.costing.api.dto.LabelTemplateDtos.AssignArticlesRequest;
import net.argeneo.costing.api.dto.LabelTemplateDtos.LabelTemplateRequest;
import net.argeneo.costing.api.dto.LabelTemplateDtos.LabelTemplateResponse;
import net.argeneo.costing.service.LabelTemplateService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Modèles d'étiquette réutilisables (mise en forme + badges), parcours Patron. */
@RestController
@RequestMapping("/api/label-templates")
@PreAuthorize("hasRole('PATRON')")
public class LabelTemplateController {

    private final LabelTemplateService service;

    public LabelTemplateController(LabelTemplateService service) {
        this.service = service;
    }

    @GetMapping
    public List<LabelTemplateResponse> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LabelTemplateResponse create(@Valid @RequestBody LabelTemplateRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public LabelTemplateResponse update(@PathVariable Long id,
                                        @Valid @RequestBody LabelTemplateRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    /** Bascule le « modèle par défaut de l'enseigne » et renvoie la liste à jour. */
    @PutMapping("/{id}/default")
    public List<LabelTemplateResponse> toggleDefault(@PathVariable Long id) {
        return service.toggleDefault(id);
    }

    /** Affecte en masse des produits à ce modèle (le règle comme modèle par défaut de chacun). */
    @PostMapping("/{id}/articles")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void assignArticles(@PathVariable Long id, @RequestBody AssignArticlesRequest request) {
        service.assignArticles(id, request.articleIds());
    }
}
