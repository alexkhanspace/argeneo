package net.argeneo.communication.api.dto;

import java.time.Instant;
import net.argeneo.communication.entity.Communication;

/** DTOs des communications archivées. */
public final class CommunicationDtos {

    private CommunicationDtos() {
    }

    /** Champs éditables (assemblés depuis le multipart par le contrôleur). */
    public record CommunicationInput(
            String brief,
            String platform,
            String tone,
            String length,
            String ambiance,
            String instruction,
            String headline,
            String caption,
            Long articleId,
            Long etablissementId,
            String afficheState) {
    }

    /** Résumé pour la liste. */
    public record CommunicationSummary(
            Long id,
            String title,
            String platform,
            Long articleId,
            boolean hasImage,
            boolean hasAfficheState,
            Instant createdAt) {

        public static CommunicationSummary from(Communication c) {
            return new CommunicationSummary(c.getId(), buildTitle(c), c.getPlatform(), c.getArticleId(),
                    c.getImageFile() != null, c.getAfficheState() != null && !c.getAfficheState().isBlank(),
                    c.getCreatedAt());
        }
    }

    public record CommunicationResponse(
            Long id,
            Long etablissementId,
            String brief,
            String platform,
            String tone,
            String length,
            String ambiance,
            String instruction,
            String headline,
            String caption,
            Long articleId,
            boolean hasImage,
            String afficheState,
            Instant createdAt,
            Instant updatedAt) {

        public static CommunicationResponse from(Communication c) {
            return new CommunicationResponse(c.getId(), c.getEtablissementId(), c.getBrief(),
                    c.getPlatform(), c.getTone(), c.getLength(), c.getAmbiance(), c.getInstruction(),
                    c.getHeadline(), c.getCaption(), c.getArticleId(), c.getImageFile() != null,
                    c.getAfficheState(), c.getCreatedAt(), c.getUpdatedAt());
        }
    }

    /** Titre lisible : accroche, sinon début du brief, sinon début de la légende. */
    static String buildTitle(Communication c) {
        String base = firstNonBlank(c.getHeadline(), c.getBrief(), c.getCaption());
        if (base == null) {
            return "Publication";
        }
        String t = base.strip().replaceAll("\\s+", " ");
        return t.length() > 80 ? t.substring(0, 80) + "…" : t;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }
}
