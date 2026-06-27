package net.argeneo.billing.api;

import jakarta.validation.Valid;
import net.argeneo.billing.api.dto.BillingProfileDtos.BillingProfileResponse;
import net.argeneo.billing.api.dto.BillingProfileDtos.SaveBillingProfileRequest;
import net.argeneo.billing.service.BillingProfileService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Profil émetteur de facturation (parcours Patron). */
@RestController
@RequestMapping("/api/billing/profile")
@PreAuthorize("hasRole('PATRON')")
public class BillingProfileController {

    private final BillingProfileService service;

    public BillingProfileController(BillingProfileService service) {
        this.service = service;
    }

    @GetMapping
    public BillingProfileResponse get(@RequestParam(required = false) Long etablissementId) {
        return service.get(etablissementId);
    }

    @PutMapping
    public BillingProfileResponse save(@RequestParam(required = false) Long etablissementId,
                                       @Valid @RequestBody SaveBillingProfileRequest request) {
        return service.save(etablissementId, request);
    }
}
