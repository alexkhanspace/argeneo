package net.argeneo.billing.api.dto;

import net.argeneo.billing.domain.BillingSettings;

/** DTOs des paramètres & mentions de facturation. */
public final class BillingSettingsDtos {

    private BillingSettingsDtos() {
    }

    public record SaveBillingSettingsRequest(
            String legalMentions,
            Integer paymentTermsDays,
            String latePenalty,
            String footer,
            String brandColor1,
            String brandColor2,
            String brandColor3) {
    }

    public record BillingSettingsResponse(
            Long id,
            Long etablissementId,
            String legalMentions,
            Integer paymentTermsDays,
            String latePenalty,
            String footer,
            String brandColor1,
            String brandColor2,
            String brandColor3) {

        public static BillingSettingsResponse from(BillingSettings s) {
            return new BillingSettingsResponse(s.getId(), s.getEtablissementId(),
                    s.getLegalMentions(), s.getPaymentTermsDays(), s.getLatePenalty(),
                    s.getFooter(), s.getBrandColor1(), s.getBrandColor2(), s.getBrandColor3());
        }
    }
}
