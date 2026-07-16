package net.argeneo.communication.service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.communication.api.dto.CommunicationDtos.CommunicationInput;
import net.argeneo.communication.api.dto.CommunicationDtos.CommunicationResponse;
import net.argeneo.communication.api.dto.CommunicationDtos.CommunicationSummary;
import net.argeneo.communication.entity.Communication;
import net.argeneo.communication.repository.CommunicationRepository;
import net.argeneo.config.ArgeneoProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/** Archivage et gestion des publications de communication (texte + visuel composé). */
@Service
public class CommunicationService {

    private final CommunicationRepository repository;
    private final Path uploadDir;

    public CommunicationService(CommunicationRepository repository, ArgeneoProperties properties) {
        this.repository = repository;
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

    @Transactional(readOnly = true)
    public List<CommunicationSummary> list() {
        return repository.findAllByOrderByCreatedAtDesc().stream().map(CommunicationSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public CommunicationResponse get(Long id) {
        return CommunicationResponse.from(require(id));
    }

    @Transactional
    public CommunicationResponse save(CommunicationInput input, MultipartFile image) {
        Communication c = new Communication();
        apply(c, input);
        if (image != null && !image.isEmpty()) {
            c.setImageFile(store(image));
            c.setImageMime(image.getContentType());
        }
        return CommunicationResponse.from(repository.save(c));
    }

    @Transactional
    public CommunicationResponse update(Long id, CommunicationInput input, MultipartFile image) {
        Communication c = require(id);
        apply(c, input);
        if (image != null && !image.isEmpty()) {
            deleteFile(c.getImageFile());
            c.setImageFile(store(image));
            c.setImageMime(image.getContentType());
        }
        return CommunicationResponse.from(repository.save(c));
    }

    @Transactional
    public void delete(Long id) {
        Communication c = require(id);
        deleteFile(c.getImageFile());
        repository.delete(c);
    }

    @Transactional(readOnly = true)
    public ImageFile loadImage(Long id) {
        Communication c = require(id);
        if (c.getImageFile() == null) {
            throw new ResourceNotFoundException("Aucun visuel pour cette communication.");
        }
        Path path = uploadDir.resolve(c.getImageFile()).normalize();
        if (!path.startsWith(uploadDir.normalize()) || !Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("Visuel introuvable.");
        }
        return new ImageFile(path, c.getImageMime() != null ? c.getImageMime() : "image/png");
    }

    public record ImageFile(Path path, String mime) {
    }

    private void apply(Communication c, CommunicationInput in) {
        c.setBrief(in.brief());
        c.setPlatform(in.platform());
        c.setTone(in.tone());
        c.setLength(in.length());
        c.setAmbiance(in.ambiance());
        c.setInstruction(in.instruction());
        c.setHeadline(in.headline());
        c.setCaption(in.caption());
        c.setArticleId(in.articleId());
        c.setEtablissementId(in.etablissementId());
        if (in.afficheState() != null) {
            c.setAfficheState(in.afficheState());
        }
    }

    private String store(MultipartFile image) {
        String ext = StringUtils.getFilenameExtension(image.getOriginalFilename());
        ext = ext != null && List.of("png", "jpg", "jpeg", "webp").contains(ext.toLowerCase(Locale.ROOT))
                ? "." + ext.toLowerCase(Locale.ROOT) : ".png";
        String name = UUID.randomUUID().toString().replace("-", "") + ext;
        try {
            Files.copy(image.getInputStream(), uploadDir.resolve(name), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("Échec de l'écriture du visuel", e);
        }
        return name;
    }

    private void deleteFile(String name) {
        if (name == null) {
            return;
        }
        try {
            Path path = uploadDir.resolve(name).normalize();
            if (path.startsWith(uploadDir.normalize())) {
                Files.deleteIfExists(path);
            }
        } catch (IOException ignored) {
            // best-effort
        }
    }

    private Communication require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Communication introuvable : " + id));
    }
}
