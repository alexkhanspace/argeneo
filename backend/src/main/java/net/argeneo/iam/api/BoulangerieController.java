package net.argeneo.iam.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.iam.api.dto.BoulangerieDtos.BoulangerieResponse;
import net.argeneo.iam.api.dto.BoulangerieDtos.CreateBoulangerieRequest;
import net.argeneo.iam.service.BoulangerieService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Parcours Patron : gestion des boulangeries de son tenant. */
@RestController
@RequestMapping("/api/boulangeries")
@PreAuthorize("hasRole('PATRON')")
public class BoulangerieController {

    private final BoulangerieService boulangerieService;

    public BoulangerieController(BoulangerieService boulangerieService) {
        this.boulangerieService = boulangerieService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BoulangerieResponse create(@Valid @RequestBody CreateBoulangerieRequest request) {
        return boulangerieService.create(request);
    }

    @GetMapping
    public List<BoulangerieResponse> list() {
        return boulangerieService.list();
    }
}
