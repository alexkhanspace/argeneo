package net.argeneo.security;

import net.argeneo.audit.AuditService;
import net.argeneo.security.AuthAccountReader.AuthAccount;
import net.argeneo.security.AuthDtos.LoginResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/** Logique de connexion e-mail + mot de passe. */
@Service
public class AuthService {

    private final AuthAccountReader accountReader;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService audit;

    public AuthService(AuthAccountReader accountReader,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       AuditService audit) {
        this.accountReader = accountReader;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.audit = audit;
    }

    public LoginResponse login(String email, String rawPassword) {
        // E-mail normalisé : sert aussi à tracer un éventuel échec sans divulguer le motif.
        String normalizedEmail = email.trim().toLowerCase();

        AuthAccount account = accountReader.findByEmail(normalizedEmail)
                .orElseThrow(() -> {
                    audit.recordExplicit(null, null, normalizedEmail, null,
                            "LOGIN_FAILURE", "Échec de connexion");
                    return new BadCredentialsException("Identifiants invalides");
                });

        if (!account.active() || !passwordEncoder.matches(rawPassword, account.passwordHash())) {
            audit.recordExplicit(null, null, normalizedEmail, null,
                    "LOGIN_FAILURE", "Échec de connexion");
            throw new BadCredentialsException("Identifiants invalides");
        }

        AuthPrincipal principal = new AuthPrincipal(
                account.id(), account.email(), account.fullName(),
                account.type(), account.role(), account.tenantId(), null);

        audit.recordExplicit(account.type().name(), account.id(), account.email(),
                account.tenantId(), "LOGIN_SUCCESS", "Connexion");

        return new LoginResponse(
                jwtService.generate(principal),
                jwtService.expirationSeconds(),
                account.email(),
                account.fullName(),
                account.type().name(),
                account.role() == null ? null : account.role().name(),
                account.tenantId());
    }
}
