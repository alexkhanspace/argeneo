package net.argeneo.costing.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import net.argeneo.costing.entity.LabelTemplate;

/** DTOs des modèles d'étiquette (mise en forme + badges). */
public final class LabelTemplateDtos {

    private LabelTemplateDtos() {
    }

    /** Un badge du modèle : soit un texte coloré (Kasher…), soit une image (médaille, data URL). */
    public record Badge(String text, String color, String img) {
    }

    /** Création / mise à jour d'un modèle (les mêmes champs dans les deux sens). */
    public record LabelTemplateRequest(
            @NotBlank @Size(max = 120) String name,
            @Size(max = 120) String brand,
            String bgColor,
            String textColor,
            String borderColor,
            Double widthCm,
            Double heightCm,
            Double fontScale,
            Boolean showPrice,
            String frame,
            Boolean chalk,
            Boolean fillSheet,
            String badgePos,
            Double badgeScale,
            String extraText,
            Boolean useDescription,
            List<Badge> badges) {
    }

    public record LabelTemplateResponse(
            Long id,
            String name,
            String brand,
            String bgColor,
            String textColor,
            String borderColor,
            double widthCm,
            double heightCm,
            double fontScale,
            boolean showPrice,
            String frame,
            boolean chalk,
            boolean fillSheet,
            String badgePos,
            double badgeScale,
            String extraText,
            boolean useDescription,
            List<Badge> badges,
            boolean enseigneDefault) {

        public static LabelTemplateResponse from(LabelTemplate t, List<Badge> badges) {
            return new LabelTemplateResponse(
                    t.getId(), t.getName(), t.getBrand(),
                    t.getBgColor(), t.getTextColor(), t.getBorderColor(),
                    t.getWidthCm(), t.getHeightCm(), t.getFontScale(), t.isShowPrice(),
                    t.getFrame(), t.isChalk(), t.isFillSheet(),
                    t.getBadgePos(), t.getBadgeScale(),
                    t.getExtraText(), t.isUseDescription(), badges, t.isEnseigneDefault());
        }
    }

    /** Affectation en masse de produits à un modèle (depuis la page Modèles). */
    public record AssignArticlesRequest(List<Long> articleIds) {
    }
}
