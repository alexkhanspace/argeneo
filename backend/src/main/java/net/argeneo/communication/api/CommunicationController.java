package net.argeneo.communication.api;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.util.List;
import net.argeneo.communication.api.dto.CommunicationDtos.CommunicationInput;
import net.argeneo.communication.api.dto.CommunicationDtos.CommunicationResponse;
import net.argeneo.communication.api.dto.CommunicationDtos.CommunicationSummary;
import net.argeneo.communication.service.CommunicationService;
import net.argeneo.communication.service.CommunicationService.ImageFile;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Archivage des publications de communication (parcours Patron). */
@RestController
@RequestMapping("/api/communications")
@PreAuthorize("hasRole('PATRON')")
public class CommunicationController {

    private final CommunicationService service;

    public CommunicationController(CommunicationService service) {
        this.service = service;
    }

    @GetMapping
    public List<CommunicationSummary> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public CommunicationResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommunicationResponse create(
            @RequestParam(required = false) MultipartFile image,
            @RequestParam(required = false) String brief,
            @RequestParam(required = false) String platform,
            @RequestParam(required = false) String tone,
            @RequestParam(required = false) String length,
            @RequestParam(required = false) String ambiance,
            @RequestParam(required = false) String instruction,
            @RequestParam(required = false) String headline,
            @RequestParam(required = false) String caption,
            @RequestParam(required = false) Long articleId,
            @RequestParam(required = false) Long etablissementId) {
        return service.save(new CommunicationInput(brief, platform, tone, length, ambiance, instruction,
                headline, caption, articleId, etablissementId), image);
    }

    @PutMapping("/{id}")
    public CommunicationResponse update(
            @PathVariable Long id,
            @RequestParam(required = false) MultipartFile image,
            @RequestParam(required = false) String brief,
            @RequestParam(required = false) String platform,
            @RequestParam(required = false) String tone,
            @RequestParam(required = false) String length,
            @RequestParam(required = false) String ambiance,
            @RequestParam(required = false) String instruction,
            @RequestParam(required = false) String headline,
            @RequestParam(required = false) String caption,
            @RequestParam(required = false) Long articleId,
            @RequestParam(required = false) Long etablissementId) {
        return service.update(id, new CommunicationInput(brief, platform, tone, length, ambiance, instruction,
                headline, caption, articleId, etablissementId), image);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    /** Sert le visuel composé (authentifié). */
    @GetMapping("/{id}/image")
    public ResponseEntity<Resource> image(@PathVariable Long id) {
        ImageFile img = service.loadImage(id);
        long length;
        try {
            length = Files.size(img.path());
        } catch (IOException e) {
            throw new UncheckedIOException("Lecture du visuel impossible", e);
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(img.mime()))
                .contentLength(length)
                .body(new PathResource(img.path()));
    }
}
