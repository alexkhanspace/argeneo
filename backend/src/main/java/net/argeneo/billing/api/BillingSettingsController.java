package net.argeneo.billing.api;

import jakarta.validation.Valid;
import net.argeneo.billing.api.dto.BillingSettingsDtos.BillingSettingsResponse;
import net.argeneo.billing.api.dto.BillingSettingsDtos.SaveBillingSettingsRequest;
import net.argeneo.billing.service.BillingSettingsService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Paramètres & mentions de facturation (parcours Patron). */
@RestController
@RequestMapping("/api/billing/settings")
@PreAuthorize("hasRole('PATRON')")
public class BillingSettingsController {

    private final BillingSettingsService service;

    public BillingSettingsController(BillingSettingsService service) {
        this.service = service;
    }

    @GetMapping
    public BillingSettingsResponse get(@RequestParam(required = false) Long etablissementId) {
        return service.get(etablissementId);
    }

    @PutMapping
    public BillingSettingsResponse save(@RequestParam(required = false) Long etablissementId,
                                        @Valid @RequestBody SaveBillingSettingsRequest request) {
        return service.save(etablissementId, request);
    }
}
