package net.argeneo.costing.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.costing.api.dto.MaterialDtos.CreateRawMaterialRequest;
import net.argeneo.costing.api.dto.MaterialDtos.RawMaterialResponse;
import net.argeneo.costing.api.dto.MaterialDtos.UpdateRawMaterialRequest;
import net.argeneo.costing.service.MaterialService;
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

/** Matières premières (parcours Patron). */
@RestController
@RequestMapping("/api/raw-materials")
@PreAuthorize("hasRole('PATRON')")
public class RawMaterialController {

    private final MaterialService materialService;

    public RawMaterialController(MaterialService materialService) {
        this.materialService = materialService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RawMaterialResponse create(@Valid @RequestBody CreateRawMaterialRequest request) {
        return materialService.create(request);
    }

    @GetMapping
    public List<RawMaterialResponse> list() {
        return materialService.list();
    }

    @PutMapping("/{id}")
    public RawMaterialResponse update(@PathVariable Long id,
                                      @Valid @RequestBody UpdateRawMaterialRequest request) {
        return materialService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        materialService.delete(id);
    }
}
