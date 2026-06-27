package net.argeneo.iam.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import net.argeneo.iam.service.AdminUserService;
import net.argeneo.iam.service.AdminUserService.AdminUserRow;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Super-Admin : annuaire de tous les comptes + réinitialisation de mot de passe. */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    public record ResetPasswordRequest(
            @NotNull @Pattern(regexp = "ADMIN|USER") String kind,
            @NotNull Long id,
            @NotBlank @Size(min = 8, message = "8 caractères minimum") String newPassword) {
    }

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public List<AdminUserRow> list() {
        return adminUserService.listAll();
    }

    @PutMapping("/reset-password")
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        adminUserService.resetPassword(request.kind(), request.id(), request.newPassword());
    }

    public record SetRoleRequest(@NotNull @Pattern(regexp = "PATRON|EMPLOYE") String role) {
    }

    /** Promeut (EMPLOYE → PATRON) ou rétrograde (PATRON → EMPLOYE) un utilisateur métier. */
    @PutMapping("/{id}/role")
    public void setRole(@PathVariable Long id, @Valid @RequestBody SetRoleRequest request) {
        adminUserService.setUserRole(id, request.role());
    }

    /**
     * Désactive un utilisateur métier (soft-delete : {@code active = false}), ce qui
     * coupe sa connexion. {@code id} est l'identifiant d'un {@code app_user} ; les
     * comptes Super-Admin ne sont pas désactivables par cette route.
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable Long id) {
        adminUserService.deactivateUser(id);
    }
}
