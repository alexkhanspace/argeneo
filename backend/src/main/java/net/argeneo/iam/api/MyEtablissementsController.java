package net.argeneo.iam.api;

import java.util.List;
import net.argeneo.iam.service.MeAccessService;
import net.argeneo.iam.service.MeAccessService.AccessibleEtablissement;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Etablissements que l'utilisateur courant peut piloter (alimente la saisie quotidienne). */
@RestController
@RequestMapping("/api/me/etablissements")
public class MyEtablissementsController {

    private final MeAccessService meAccessService;

    public MyEtablissementsController(MeAccessService meAccessService) {
        this.meAccessService = meAccessService;
    }

    @GetMapping
    public List<AccessibleEtablissement> myEtablissements() {
        return meAccessService.myEtablissements();
    }
}
