package net.argeneo.iam.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import net.argeneo.iam.service.AdminUserService;
import net.argeneo.iam.service.AdminUserService.AdminUserRow;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
}
