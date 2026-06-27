package net.argeneo.costing.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.List;

/** DTOs de composition d'un article MENU. */
public final class MenuDtos {

    private MenuDtos() {
    }

    /** Un composant tel que renvoyé au front (avec le libellé de l'article). */
    public record MenuItemView(
            Long componentArticleId,
            String componentCode,
            String componentName,
            BigDecimal quantity) {
    }

    public record SaveMenuItem(
            @NotNull Long componentArticleId,
            @NotNull @Positive BigDecimal quantity) {
    }

    public record SaveMenuRequest(List<SaveMenuItem> items) {
    }
}
