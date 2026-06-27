package net.argeneo.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration applicative Argeneo (préfixe {@code argeneo.*}). */
@ConfigurationProperties(prefix = "argeneo")
public record ArgeneoProperties(Security security, Bootstrap bootstrap, Gemini gemini, Uploads uploads) {

    /** Vertex AI (Gemini + Imagen) : compte de service + projet/région/modèles. */
    public record Gemini(String serviceAccountPath, String project, String location, String model,
                         String imageModel, String imageEditModel) {
    }

    /** Stockage des fichiers uploadés (photos d'articles, etc.). */
    public record Uploads(String dir) {
    }

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
