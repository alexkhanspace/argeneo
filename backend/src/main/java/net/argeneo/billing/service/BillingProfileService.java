package net.argeneo.billing.service;

import net.argeneo.billing.api.dto.BillingProfileDtos.BillingProfileResponse;
import net.argeneo.billing.api.dto.BillingProfileDtos.SaveBillingProfileRequest;
import net.argeneo.billing.domain.BillingProfile;
import net.argeneo.billing.repository.BillingProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Profil émetteur de l'établissement courant : get + upsert. */
@Service
public class BillingProfileService {

    private final BillingProfileRepository repository;
    private final BillingContext context;

    public BillingProfileService(BillingProfileRepository repository, BillingContext context) {
        this.repository = repository;
        this.context = context;
    }

    @Transactional(readOnly = true)
    public BillingProfileResponse get(Long etablissementId) {
        Long etabId = context.currentEtablissementId(etablissementId);
        return repository.findByEtablissementId(etabId)
                .map(BillingProfileResponse::from)
                .orElseGet(() -> new BillingProfileResponse(null, etabId, null, null, null, null,
                        null, null, null, null, null, null, null, null));
    }

    @Transactional
    public BillingProfileResponse save(Long etablissementId, SaveBillingProfileRequest request) {
        Long etabId = context.currentEtablissementId(etablissementId);
        BillingProfile profile = repository.findByEtablissementId(etabId).orElseGet(() -> {
            BillingProfile created = new BillingProfile();
            created.setEtablissementId(etabId);
            return created;
        });
        profile.setSiren(request.siren());
        profile.setSiret(request.siret());
        profile.setTvaIntra(request.tvaIntra());
        profile.setRcs(request.rcs());
        profile.setApe(request.ape());
        profile.setLegalForm(request.legalForm());
        profile.setShareCapital(request.shareCapital());
        profile.setIban(request.iban());
        profile.setBic(request.bic());
        profile.setContactEmail(request.contactEmail());
        profile.setContactPhone(request.contactPhone());
        return BillingProfileResponse.from(repository.save(profile));
    }
}
