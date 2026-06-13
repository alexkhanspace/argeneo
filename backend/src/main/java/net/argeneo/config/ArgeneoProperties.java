package net.argeneo.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration applicative Argeneo (préfixe {@code argeneo.*}). */
@ConfigurationProperties(prefix = "argeneo")
public record ArgeneoProperties(Security security, Bootstrap bootstrap) {

    public record Security(Jwt jwt, Cors cors) {
    }

    public record Jwt(String secret, long expirationMinutes) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Bootstrap(SuperAdmin superAdmin) {
    }

    public record SuperAdmin(boolean enabled, String email, String password, String fullName) {
    }
}
