package net.argeneo.iam.api.dto;

import jakarta.validation.constraints.NotBlank;
import net.argeneo.iam.domain.Etablissement;

/** DTOs des etablissements (parcours Patron). */
public final class EtablissementDtos {

    private EtablissementDtos() {
    }

    public record CreateEtablissementRequest(
            @NotBlank String name,
            String address) {
    }

    public record EtablissementResponse(
            Long id,
            String name,
            String address,
            boolean active) {

        public static EtablissementResponse from(Etablissement b) {
            return new EtablissementResponse(b.getId(), b.getName(), b.getAddress(), b.isActive());
        }
    }
}
