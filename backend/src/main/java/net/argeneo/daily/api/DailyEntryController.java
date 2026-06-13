package net.argeneo.daily.api;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import net.argeneo.daily.api.dto.DailyDtos.DailyEntryResponse;
import net.argeneo.daily.api.dto.DailyDtos.SetLossRequest;
import net.argeneo.daily.api.dto.DailyDtos.SetNoteRequest;
import net.argeneo.daily.api.dto.DailyDtos.SetRevenueRequest;
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

    @PutMapping("/{date}/revenue")
    @PreAuthorize("@etablissementAccess.canRevenue(#etablissementId)")
    public DailyEntryResponse setRevenue(
            @PathVariable Long etablissementId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Valid @RequestBody SetRevenueRequest request) {
        return service.setRevenue(etablissementId, date, request.revenue());
    }

    @PutMapping("/{date}/loss")
    @PreAuthorize("@etablissementAccess.canLoss(#etablissementId)")
    public DailyEntryResponse setLoss(
            @PathVariable Long etablissementId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Valid @RequestBody SetLossRequest request) {
        return service.setLoss(etablissementId, date, request.loss());
    }

    @PutMapping("/{date}/note")
    @PreAuthorize("@etablissementAccess.canNote(#etablissementId)")
    public DailyEntryResponse setNote(
            @PathVariable Long etablissementId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestBody SetNoteRequest request) {
        return service.setNote(etablissementId, date, request.note());
    }
}
