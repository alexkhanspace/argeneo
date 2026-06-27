package net.argeneo.iam.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import net.argeneo.iam.domain.RecipeScope;
import net.argeneo.iam.domain.Tenant;

/** DTOs du parcours Super-Admin (gestion des tenants). */
public final class TenantDtos {

    private TenantDtos() {
    }

    /** Crée un tenant + son patron initial. */
    public record CreateTenantRequest(
            @NotBlank String name,
            RecipeScope recipeScope,
            @NotBlank @Email String patronEmail,
            @NotBlank @Size(min = 8, message = "8 caractères minimum") String patronPassword,
            @NotBlank String patronFullName) {
    }

    /** Met à jour l'enseigne (nom + portée des recettes). */
    public record UpdateTenantRequest(
            @NotBlank String name,
            RecipeScope recipeScope) {
    }

    public record TenantResponse(
            Long id,
            String name,
            RecipeScope recipeScope,
            boolean active,
            Instant createdAt) {

        public static TenantResponse from(Tenant t) {
            return new TenantResponse(t.getId(), t.getName(), t.getRecipeScope(),
                    t.isActive(), t.getCreatedAt());
        }
    }
}
