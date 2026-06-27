package net.argeneo.daily.api;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import net.argeneo.daily.api.dto.DailyDtos.DailyEntryResponse;
import net.argeneo.daily.api.dto.DailyDtos.UpsertDailyRequest;
import net.argeneo.daily.service.DailyEntryService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Saisie quotidienne d'une etablissement. Accès gouverné par les autorités
 * contextualisées (Patron, ou employé avec la permission idoine sur la etablissement).
 */
@RestController
@RequestMapping("/api/etablissements/{etablissementId}/daily")
public class DailyEntryController {

    private final DailyEntryService service;

    public DailyEntryController(DailyEntryService service) {
        this.service = service;
    }

    @GetMapping("/{date}")
    @PreAuthorize("@etablissementAccess.canReadDaily(#etablissementId)")
    public DailyEntryResponse day(
            @PathVariable Long etablissementId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.getDay(etablissementId, date);
    }

    @GetMapping
    @PreAuthorize("@etablissementAccess.canReadDaily(#etablissementId)")
    public List<DailyEntryResponse> range(
            @PathVariable Long etablissementId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.listRange(etablissementId, from, to);
    }

    /**
     * Enregistrement global de la journée (CA, casse par article, mots du jour)
     * en une seule requête. Le service n'applique que les parties autorisées.
     */
    @PutMapping("/{date}")
    @PreAuthorize("@etablissementAccess.canReadDaily(#etablissementId)")
    public DailyEntryResponse upsert(
            @PathVariable Long etablissementId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Valid @RequestBody UpsertDailyRequest request) {
        return service.upsert(etablissementId, date, request);
    }
}
