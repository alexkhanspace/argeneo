package net.argeneo.billing.api.dto;

import java.math.BigDecimal;
import net.argeneo.billing.domain.BillingProfile;

/** DTOs du profil émetteur (identité légale & coordonnées bancaires). */
public final class BillingProfileDtos {

    private BillingProfileDtos() {
    }

    public record SaveBillingProfileRequest(
            String siren,
            String siret,
            String tvaIntra,
            String rcs,
            String ape,
            String legalForm,
            BigDecimal shareCapital,
            String iban,
            String bic,
            String contactEmail,
            String contactPhone) {
    }

    public record BillingProfileResponse(
            Long id,
            Long etablissementId,
            String siren,
            String siret,
            String tvaIntra,
            String rcs,
            String ape,
            String legalForm,
            BigDecimal shareCapital,
            String iban,
            String bic,
            String contactEmail,
            String contactPhone,
            String logoFile) {

        public static BillingProfileResponse from(BillingProfile p) {
            return new BillingProfileResponse(p.getId(), p.getEtablissementId(), p.getSiren(),
                    p.getSiret(), p.getTvaIntra(), p.getRcs(), p.getApe(), p.getLegalForm(),
                    p.getShareCapital(), p.getIban(), p.getBic(), p.getContactEmail(),
                    p.getContactPhone(), p.getLogoFile());
        }
    }
}
