package net.argeneo.billing.service;

import java.util.List;
import net.argeneo.billing.api.dto.ClientDtos.ClientResponse;
import net.argeneo.billing.api.dto.ClientDtos.CreateClientRequest;
import net.argeneo.billing.api.dto.ClientDtos.UpdateClientRequest;
import net.argeneo.billing.domain.Client;
import net.argeneo.billing.repository.ClientRepository;
import net.argeneo.common.error.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Gestion des clients de facturation (scopé tenant). */
@Service
public class ClientService {

    private final ClientRepository repository;

    public ClientService(ClientRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ClientResponse> list() {
        return repository.findAll().stream()
                .sorted((a, b) -> a.getName().compareToIgnoreCase(b.getName()))
                .map(ClientResponse::from)
                .toList();
    }

    @Transactional
    public ClientResponse create(CreateClientRequest request) {
        Client client = new Client();
        client.setName(request.name());
        client.setKind(request.kind());
        client.setSiret(request.siret());
        client.setTvaIntra(request.tvaIntra());
        client.setEmail(request.email());
        client.setPhone(request.phone());
        client.setAddress(request.address());
        client.setPostalCode(request.postalCode());
        client.setCity(request.city());
        if (request.country() != null && !request.country().isBlank()) {
            client.setCountry(request.country());
        }
        return ClientResponse.from(repository.save(client));
    }

    @Transactional
    public ClientResponse update(Long id, UpdateClientRequest request) {
        Client client = require(id);
        client.setName(request.name());
        client.setKind(request.kind());
        client.setSiret(request.siret());
        client.setTvaIntra(request.tvaIntra());
        client.setEmail(request.email());
        client.setPhone(request.phone());
        client.setAddress(request.address());
        client.setPostalCode(request.postalCode());
        client.setCity(request.city());
        if (request.country() != null && !request.country().isBlank()) {
            client.setCountry(request.country());
        }
        if (request.active() != null) {
            client.setActive(request.active());
        }
        return ClientResponse.from(repository.save(client));
    }

    @Transactional
    public void deactivate(Long id) {
        Client client = require(id);
        client.setActive(false);
        repository.save(client);
    }

    private Client require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Client introuvable : " + id));
    }
}
