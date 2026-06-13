package net.argeneo.common.error;

/** Ressource introuvable (ou hors du tenant courant) -> 404. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
