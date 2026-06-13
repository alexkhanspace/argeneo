package net.argeneo.iam.api.dto;

import jakarta.validation.constraints.NotBlank;
import net.argeneo.iam.domain.Boulangerie;

/** DTOs des boulangeries (parcours Patron). */
public final class BoulangerieDtos {

    private BoulangerieDtos() {
    }

    public record CreateBoulangerieRequest(
            @NotBlank String name,
            String address) {
    }

    public record BoulangerieResponse(
            Long id,
            String name,
            String address,
            boolean active) {

        public static BoulangerieResponse from(Boulangerie b) {
            return new BoulangerieResponse(b.getId(), b.getName(), b.getAddress(), b.isActive());
        }
    }
}
