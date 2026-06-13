package net.argeneo.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import net.argeneo.config.ArgeneoProperties;
import net.argeneo.iam.domain.UserRole;
import org.springframework.stereotype.Service;

/** Émission et vérification des JWT (HS256). */
@Service
public class JwtService {

    private final SecretKey key;
    private final Duration ttl;

    public JwtService(ArgeneoProperties props) {
        this.key = Keys.hmacShaKeyFor(props.security().jwt().secret().getBytes(StandardCharsets.UTF_8));
        this.ttl = Duration.ofMinutes(props.security().jwt().expirationMinutes());
    }

    public String generate(AuthPrincipal principal) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(principal.id()))
                .claim("typ", principal.type().name())
                .claim("role", principal.role() == null ? null : principal.role().name())
                .claim("tenantId", principal.tenantId())
                .claim("email", principal.email())
                .claim("name", principal.fullName())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttl)))
                .signWith(key)
                .compact();
    }

    /** Vérifie la signature/expiration et reconstruit le principal. */
    public AuthPrincipal parse(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        PrincipalType type = PrincipalType.valueOf(claims.get("typ", String.class));
        String roleClaim = claims.get("role", String.class);
        UserRole role = roleClaim == null ? null : UserRole.valueOf(roleClaim);
        Number tenant = claims.get("tenantId", Number.class);

        return new AuthPrincipal(
                Long.valueOf(claims.getSubject()),
                claims.get("email", String.class),
                claims.get("name", String.class),
                type,
                role,
                tenant == null ? null : tenant.longValue());
    }

    public long expirationSeconds() {
        return ttl.toSeconds();
    }
}
