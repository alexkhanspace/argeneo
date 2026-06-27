package net.argeneo.billing.api;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import net.argeneo.billing.api.dto.BillingProfileDtos.BillingProfileResponse;
import net.argeneo.billing.domain.BillingProfile;
import net.argeneo.billing.repository.BillingProfileRepository;
import net.argeneo.billing.service.BillingContext;
import net.argeneo.config.ArgeneoProperties;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Upload du logo de l'émetteur (profil de facturation). Le fichier est servi via
 * /api/media/{file}. Miroir d'ArticlePhotoController pour le dossier d'upload,
 * la validation d'extension et le nommage UUID.
 */
@RestController
@PreAuthorize("hasRole('PATRON')")
public class BillingLogoController {

    private final BillingProfileRepository profileRepository;
    private final BillingContext context;
    private final Path uploadDir;

    public BillingLogoController(BillingProfileRepository profileRepository,
                                 BillingContext context,
                                 ArgeneoProperties properties) {
        this.profileRepository = profileRepository;
        this.context = context;
        this.uploadDir = Path.of(properties.uploads().dir());
    }

    @PostConstruct
    void ensureDir() {
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new UncheckedIOException("Impossible de créer le dossier d'upload : " + uploadDir, e);
        }
    }

    @PostMapping("/api/billing/profile/logo")
    @Transactional
    public BillingProfileResponse upload(@RequestParam(value = "etablissementId", required = false) Long etablissementId,
                                         @RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier vide");
        }
        Long etabId = context.currentEtablissementId(etablissementId);
        BillingProfile profile = profileRepository.findByEtablissementId(etabId).orElseGet(() -> {
            BillingProfile created = new BillingProfile();
            created.setEtablissementId(etabId);
            return created;
        });

        String ext = extension(file.getOriginalFilename());
        String name = UUID.randomUUID().toString().replace("-", "") + ext;
        Path target = uploadDir.resolve(name);
        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Échec de l'écriture du fichier", e);
        }

        profile.setLogoFile(name);
        return BillingProfileResponse.from(profileRepository.save(profile));
    }

    /** Extension minuscule avec le point (ex. ".png"), bornée aux types image courants. */
    private static String extension(String original) {
        String ext = StringUtils.getFilenameExtension(original);
        if (ext == null) {
            return "";
        }
        ext = ext.toLowerCase();
        return switch (ext) {
            case "jpg", "jpeg", "png", "webp", "gif" -> "." + ext;
            default -> "";
        };
    }
}
