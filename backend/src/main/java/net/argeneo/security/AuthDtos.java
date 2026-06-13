package net.argeneo.security;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** DTOs d'authentification. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password) {
    }

    public record LoginResponse(
            String token,
            long expiresInSeconds,
            String email,
            String fullName,
            String type,
            String role,
            Long tenantId) {
    }
}
