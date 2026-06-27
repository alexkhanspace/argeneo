package net.argeneo.billing.service;

import net.argeneo.billing.api.dto.BillingSettingsDtos.BillingSettingsResponse;
import net.argeneo.billing.api.dto.BillingSettingsDtos.SaveBillingSettingsRequest;
import net.argeneo.billing.domain.BillingSettings;
import net.argeneo.billing.repository.BillingSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Paramètres & mentions de facturation de l'établissement courant : get + upsert. */
@Service
public class BillingSettingsService {

    private final BillingSettingsRepository repository;
    private final BillingContext context;

    public BillingSettingsService(BillingSettingsRepository repository, BillingContext context) {
        this.repository = repository;
        this.context = context;
    }

    @Transactional(readOnly = true)
    public BillingSettingsResponse get(Long etablissementId) {
        Long etabId = context.currentEtablissementId(etablissementId);
        return repository.findByEtablissementId(etabId)
                .map(BillingSettingsResponse::from)
                .orElseGet(() -> new BillingSettingsResponse(null, etabId, null, null, null, null, null, null, null));
    }

    @Transactional
    public BillingSettingsResponse save(Long etablissementId, SaveBillingSettingsRequest request) {
        Long etabId = context.currentEtablissementId(etablissementId);
        BillingSettings settings = repository.findByEtablissementId(etabId).orElseGet(() -> {
            BillingSettings created = new BillingSettings();
            created.setEtablissementId(etabId);
            return created;
        });
        settings.setLegalMentions(request.legalMentions());
        settings.setPaymentTermsDays(request.paymentTermsDays());
        settings.setLatePenalty(request.latePenalty());
        settings.setFooter(request.footer());
        settings.setBrandColor1(request.brandColor1());
        settings.setBrandColor2(request.brandColor2());
        settings.setBrandColor3(request.brandColor3());
        return BillingSettingsResponse.from(repository.save(settings));
    }
}
