package net.argeneo.security;

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

    public AuthService(AuthAccountReader accountReader,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.accountReader = accountReader;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public LoginResponse login(String email, String rawPassword) {
        AuthAccount account = accountReader.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BadCredentialsException("Identifiants invalides"));

        if (!account.active() || !passwordEncoder.matches(rawPassword, account.passwordHash())) {
            throw new BadCredentialsException("Identifiants invalides");
        }

        AuthPrincipal principal = new AuthPrincipal(
                account.id(), account.email(), account.fullName(),
                account.type(), account.role(), account.tenantId(), null);

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
