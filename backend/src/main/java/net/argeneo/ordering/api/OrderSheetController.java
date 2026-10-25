package net.argeneo.ordering.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.ordering.api.dto.OrderingDtos.SheetRequest;
import net.argeneo.ordering.api.dto.OrderingDtos.SheetResponse;
import net.argeneo.ordering.api.dto.OrderingDtos.SheetScanResult;
import net.argeneo.ordering.api.dto.OrderingDtos.SheetSummary;
import net.argeneo.ordering.service.OrderSheetService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Cadenciers fournisseurs. Lecture : patron et employés (pour passer commande) ;
 * création / modification / import : patron.
 */
@RestController
@RequestMapping("/api/order-sheets")
public class OrderSheetController {

    private final OrderSheetService service;

    public OrderSheetController(OrderSheetService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PATRON','EMPLOYE')")
    public List<SheetSummary> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('PATRON','EMPLOYE')")
    public SheetResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('PATRON')")
    public SheetResponse create(@Valid @RequestBody SheetRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('PATRON')")
    public SheetResponse update(@PathVariable Long id, @Valid @RequestBody SheetRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('PATRON')")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    /** Lit une page de cadencier papier (photo ou PDF) par IA ; rien n'est enregistré. */
    @PostMapping("/scan")
    @PreAuthorize("hasRole('PATRON')")
    public SheetScanResult scan(@RequestParam("file") MultipartFile file) {
        return service.scan(file);
    }
}
