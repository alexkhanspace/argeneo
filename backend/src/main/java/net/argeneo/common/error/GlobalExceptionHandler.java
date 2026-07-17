package net.argeneo.common.error;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import net.argeneo.costing.domain.CostingException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

/** Traduction des exceptions en réponses JSON homogènes. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    public record ApiError(Instant timestamp, int status, String error, String message, Object details) {
        static ApiError of(HttpStatus status, String message, Object details) {
            return new ApiError(Instant.now(), status.value(),
                    status.getReasonPhrase(), message, details);
        }
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ApiError> handleAuth(AuthenticationException ex) {
        return build(HttpStatus.UNAUTHORIZED, ex.getMessage(), null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex) {
        return build(HttpStatus.FORBIDDEN, "Accès refusé", null);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ApiError> handleNotFound(ResourceNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage(), null);
    }

    @ExceptionHandler(ConflictException.class)
    ResponseEntity<ApiError> handleConflict(ConflictException ex) {
        return build(HttpStatus.CONFLICT, ex.getMessage(), null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleIntegrity(DataIntegrityViolationException ex) {
        return build(HttpStatus.CONFLICT,
                "Suppression impossible : cet élément est encore utilisé ailleurs (recette, document…).", null);
    }

    @ExceptionHandler(CostingException.class)
    ResponseEntity<ApiError> handleCosting(CostingException ex) {
        // Cycle de sous-recettes, unités incompatibles, données manquantes…
        return build(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fields.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return build(HttpStatus.BAD_REQUEST, "Requête invalide", fields);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), null);
    }

    // Sans ces gestionnaires, l'exception remonte au conteneur → re-dispatch vers /error, qui
    // repasse par le filtre JWT et renvoie un « 401 trompeur » (voir aussi le commentaire multipart
    // dans application.yml). On traduit donc explicitement ces cas en statut clair.

    /** Renvoyé par les contrôleurs (ex. IA non configurée = 503, fichier vide = 400). */
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        return build(status, ex.getReason() != null ? ex.getReason() : status.getReasonPhrase(), null);
    }

    /** Upload trop lourd (photo plein format) : 413 explicite plutôt qu'un 401 trompeur. */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> handleUploadSize(MaxUploadSizeExceededException ex) {
        return build(HttpStatus.PAYLOAD_TOO_LARGE,
                "Image trop lourde pour l'envoi. Réduis-la (ou reprends une photo) puis réessaie.", null);
    }

    /**
     * Échecs applicatifs internes, notamment l'IA (Vertex/Gemini) qui n'a pas renvoyé d'image
     * après plusieurs tentatives : 502 explicite (upstream) au lieu d'un 401 trompeur.
     */
    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<ApiError> handleIllegalState(IllegalStateException ex) {
        return build(HttpStatus.BAD_GATEWAY,
                "Le générateur IA n'a pas répondu d'image cette fois. Réessaie dans un instant.", ex.getMessage());
    }

    private ResponseEntity<ApiError> build(HttpStatus status, String message, Object details) {
        return ResponseEntity.status(status).body(ApiError.of(status, message, details));
    }
}
