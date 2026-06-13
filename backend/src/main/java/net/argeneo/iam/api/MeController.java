package net.argeneo.iam.api;

import java.util.List;
import net.argeneo.security.AuthPrincipal;
import net.argeneo.security.CurrentUser;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Profil de l'utilisateur authentifié courant (alimente les gardes front). */
@RestController
@RequestMapping("/api/me")
public class MeController {

    public record MeResponse(
            Long id,
            String email,
            String fullName,
            String type,
            String role,
            Long tenantId,
            Long impersonatedBy,
            List<String> authorities) {
    }

    @GetMapping
    public MeResponse me() {
        AuthPrincipal principal = CurrentUser.require();
        List<String> authorities = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream().map(GrantedAuthority::getAuthority).sorted().toList();
        return new MeResponse(
                principal.id(),
                principal.email(),
                principal.fullName(),
                principal.type().name(),
                principal.role() == null ? null : principal.role().name(),
                principal.tenantId(),
                principal.impersonatedByAdminId(),
                authorities);
    }
}
