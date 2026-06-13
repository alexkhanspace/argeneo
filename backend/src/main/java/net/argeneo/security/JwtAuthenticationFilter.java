package net.argeneo.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import net.argeneo.iam.domain.UserRole;
import net.argeneo.iam.repository.PermissionGrantRepository;
import net.argeneo.tenant.TenantContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authentifie chaque requête à partir du JWT (Bearer), positionne le
 * {@link TenantContext} et construit les autorités Spring Security.
 *
 * <p>Pour un Employé, les permissions sont (re)chargées à chaque requête depuis
 * la base — un changement de droits par le patron prend effet immédiatement.</p>
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";

    private final JwtService jwtService;
    private final PermissionGrantRepository grantRepository;

    public JwtAuthenticationFilter(JwtService jwtService, PermissionGrantRepository grantRepository) {
        this.jwtService = jwtService;
        this.grantRepository = grantRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        try {
            if (header != null && header.startsWith(BEARER)) {
                authenticate(header.substring(BEARER.length()), request);
            }
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
            SecurityContextHolder.clearContext();
        }
    }

    private void authenticate(String token, HttpServletRequest request) {
        try {
            AuthPrincipal principal = jwtService.parse(token);
            if (principal.tenantId() != null) {
                TenantContext.set(principal.tenantId());
            }
            var authentication = new UsernamePasswordAuthenticationToken(
                    principal, null, authoritiesFor(principal));
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (JwtException | IllegalArgumentException invalidToken) {
            // Token invalide/expiré : on n'authentifie pas ; l'EntryPOint renverra 401.
            SecurityContextHolder.clearContext();
        }
    }

    private List<GrantedAuthority> authoritiesFor(AuthPrincipal principal) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        switch (principal.type()) {
            case ADMIN -> authorities.add(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
            case USER -> {
                if (principal.role() == UserRole.PATRON) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_PATRON"));
                } else {
                    authorities.add(new SimpleGrantedAuthority("ROLE_EMPLOYE"));
                    grantRepository.findByUserId(principal.id()).forEach(grant ->
                            authorities.add(new SimpleGrantedAuthority(
                                    grant.getPermissionCode() + ":" + grant.getEtablissementId())));
                }
            }
        }
        return authorities;
    }
}
