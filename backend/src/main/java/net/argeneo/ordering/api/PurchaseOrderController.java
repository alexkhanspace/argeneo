package net.argeneo.ordering.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.ordering.api.dto.OrderingDtos.OrderRequest;
import net.argeneo.ordering.api.dto.OrderingDtos.OrderResponse;
import net.argeneo.ordering.api.dto.OrderingDtos.OrderSummary;
import net.argeneo.ordering.service.PurchaseOrderService;
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

/**
 * Commandes fournisseurs. Le contrôle fin (permission « passer_commande » sur l'établissement)
 * est fait par le service, l'établissement n'étant pas dans l'URL.
 */
@RestController
@RequestMapping("/api/purchase-orders")
@PreAuthorize("hasAnyRole('PATRON','EMPLOYE')")
public class PurchaseOrderController {

    private final PurchaseOrderService service;

    public PurchaseOrderController(PurchaseOrderService service) {
        this.service = service;
    }

    @GetMapping
    public List<OrderSummary> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse create(@Valid @RequestBody OrderRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public OrderResponse update(@PathVariable Long id, @Valid @RequestBody OrderRequest request) {
        return service.update(id, request);
    }

    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasRole('PATRON')")
    public OrderResponse reopen(@PathVariable Long id) {
        return service.reopen(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
