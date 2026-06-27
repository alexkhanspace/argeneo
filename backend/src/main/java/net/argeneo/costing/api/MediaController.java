package net.argeneo.costing.api;

import java.nio.file.Files;
import java.nio.file.Path;
import net.argeneo.config.ArgeneoProperties;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Service public de fichiers uploadés (photos d'articles).
 * Les noms sont des UUID non devinables ; l'accès est ouvert (voir SecurityConfig).
 */
@RestController
public class MediaController {

    private final Path uploadDir;

    public MediaController(ArgeneoProperties properties) {
        this.uploadDir = Path.of(properties.uploads().dir());
    }

    @GetMapping("/api/media/{file}")
    public ResponseEntity<Resource> serve(@PathVariable String file) {
        // Anti path-traversal : noms simples uniquement (pas de séparateur ni de ..).
        if (file.contains("/") || file.contains("\\") || file.contains("..")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nom de fichier invalide");
        }
        Path path = uploadDir.resolve(file).normalize();
        if (!path.startsWith(uploadDir.normalize()) || !Files.isRegularFile(path)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier introuvable");
        }
        MediaType contentType = contentType(file);
        return ResponseEntity.ok().contentType(contentType).body(new PathResource(path));
    }

    private static MediaType contentType(String file) {
        String ext = StringUtils.getFilenameExtension(file);
        if (ext == null) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        return switch (ext.toLowerCase()) {
            case "jpg", "jpeg" -> MediaType.IMAGE_JPEG;
            case "png" -> MediaType.IMAGE_PNG;
            case "gif" -> MediaType.IMAGE_GIF;
            case "webp" -> MediaType.parseMediaType("image/webp");
            default -> MediaType.APPLICATION_OCTET_STREAM;
        };
    }
}
