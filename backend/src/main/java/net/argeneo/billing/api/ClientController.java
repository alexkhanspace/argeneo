package net.argeneo.billing.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.billing.api.dto.ClientDtos.ClientResponse;
import net.argeneo.billing.api.dto.ClientDtos.CreateClientRequest;
import net.argeneo.billing.api.dto.ClientDtos.UpdateClientRequest;
import net.argeneo.billing.service.ClientService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Clients de facturation (parcours Patron). */
@RestController
@RequestMapping("/api/clients")
@PreAuthorize("hasRole('PATRON')")
public class ClientController {

    private final ClientService clientService;

    public ClientController(ClientService clientService) {
        this.clientService = clientService;
    }

    @GetMapping
    public List<ClientResponse> list() {
        return clientService.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ClientResponse create(@Valid @RequestBody CreateClientRequest request) {
        return clientService.create(request);
    }

    @PutMapping("/{id}")
    public ClientResponse update(@PathVariable Long id,
                                 @Valid @RequestBody UpdateClientRequest request) {
        return clientService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivate(@PathVariable Long id) {
        clientService.deactivate(id);
    }
}
