package net.argeneo.iam.api;

import net.argeneo.iam.service.DashboardLayoutService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Tableau de bord personnalisé du principal courant (toute personne authentifiée). */
@RestController
@RequestMapping("/api/me/dashboard")
public class DashboardLayoutController {

    private final DashboardLayoutService service;

    public DashboardLayoutController(DashboardLayoutService service) {
        this.service = service;
    }

    /** Configuration du dashboard : {@code layout} = JSON (null si jamais personnalisé). */
    public record DashboardDto(String layout) {
    }

    @GetMapping
    public DashboardDto get() {
        return new DashboardDto(service.get());
    }

    @PutMapping
    public DashboardDto save(@RequestBody DashboardDto body) {
        return new DashboardDto(service.save(body.layout()));
    }
}
