package net.argeneo.common.error;

/** Conflit métier (ex. e-mail déjà utilisé) -> 409. */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
