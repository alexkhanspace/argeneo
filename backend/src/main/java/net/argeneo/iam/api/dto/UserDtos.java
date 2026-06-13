package net.argeneo.iam.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import net.argeneo.iam.domain.AppUser;
import net.argeneo.iam.domain.UserRole;

/** DTOs des utilisateurs métier (parcours Patron). */
public final class UserDtos {

    private UserDtos() {
    }

    public record CreateEmployeeRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, message = "8 caractères minimum") String password,
            @NotBlank String fullName) {
    }

    public record UserResponse(
            Long id,
            String email,
            String fullName,
            UserRole role,
            boolean active) {

        public static UserResponse from(AppUser u) {
            return new UserResponse(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.isActive());
        }
    }

    /** Droits d'un user sur une etablissement donnée. */
    public record EtablissementPermissions(
            Long etablissementId,
            List<String> permissionCodes) {
    }

    /** Remplace l'ensemble des permissions d'un user sur une etablissement. */
    public record AssignPermissionsRequest(
            @NotNull Long etablissementId,
            @NotNull List<String> permissionCodes) {
    }

    public record UserPermissionsResponse(
            Long userId,
            List<EtablissementPermissions> etablissements) {
    }
}
