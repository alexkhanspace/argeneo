package net.argeneo.billing.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import net.argeneo.billing.domain.Client;
import net.argeneo.billing.domain.ClientKind;

/** DTOs des clients de facturation. */
public final class ClientDtos {

    private ClientDtos() {
    }

    public record CreateClientRequest(
            @NotBlank String name,
            @NotNull ClientKind kind,
            String siret,
            String tvaIntra,
            String email,
            String phone,
            String address,
            String postalCode,
            String city,
            String country) {
    }

    public record UpdateClientRequest(
            @NotBlank String name,
            @NotNull ClientKind kind,
            String siret,
            String tvaIntra,
            String email,
            String phone,
            String address,
            String postalCode,
            String city,
            String country,
            Boolean active) {
    }

    public record ClientResponse(
            Long id,
            String name,
            ClientKind kind,
            String siret,
            String tvaIntra,
            String email,
            String phone,
            String address,
            String postalCode,
            String city,
            String country,
            boolean active) {

        public static ClientResponse from(Client c) {
            return new ClientResponse(c.getId(), c.getName(), c.getKind(), c.getSiret(),
                    c.getTvaIntra(), c.getEmail(), c.getPhone(), c.getAddress(),
                    c.getPostalCode(), c.getCity(), c.getCountry(), c.isActive());
        }
    }
}
