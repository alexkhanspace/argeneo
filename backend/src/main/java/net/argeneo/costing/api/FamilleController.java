package net.argeneo.costing.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.costing.api.dto.FamilleDtos.CreateFamilleRequest;
import net.argeneo.costing.api.dto.FamilleDtos.FamilleResponse;
import net.argeneo.costing.api.dto.FamilleDtos.UpdateFamilleRequest;
import net.argeneo.costing.entity.FamilleScope;
import net.argeneo.costing.service.FamilleService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Référentiel des familles / sous-familles (parcours Patron), séparé par périmètre. */
@RestController
@RequestMapping("/api/familles")
@PreAuthorize("hasRole('PATRON')")
public class FamilleController {

    private final FamilleService familleService;

    public FamilleController(FamilleService familleService) {
        this.familleService = familleService;
    }

    @GetMapping
    public List<FamilleResponse> list(@RequestParam FamilleScope scope) {
        return familleService.tree(scope);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FamilleResponse create(@RequestParam FamilleScope scope,
                                  @Valid @RequestBody CreateFamilleRequest request) {
        return familleService.create(scope, request);
    }

    @PutMapping("/{id}")
    public FamilleResponse update(@PathVariable Long id,
                                  @RequestParam FamilleScope scope,
                                  @Valid @RequestBody UpdateFamilleRequest request) {
        return familleService.update(id, scope, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @RequestParam FamilleScope scope) {
        familleService.delete(id, scope);
    }
}
