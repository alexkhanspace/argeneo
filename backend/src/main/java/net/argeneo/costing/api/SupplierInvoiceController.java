package net.argeneo.costing.api;

import jakarta.validation.Valid;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.util.List;
import net.argeneo.costing.api.dto.InvoiceDtos.ApplyRequest;
import net.argeneo.costing.api.dto.InvoiceDtos.InvoiceResponse;
import net.argeneo.costing.api.dto.InvoiceDtos.InvoiceSummary;
import net.argeneo.costing.service.SupplierInvoiceService;
import net.argeneo.costing.service.SupplierInvoiceService.ScanFile;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Factures fournisseurs : scan IA, revue et application aux matières premières (parcours Patron). */
@RestController
@RequestMapping("/api/supplier-invoices")
@PreAuthorize("hasRole('PATRON')")
public class SupplierInvoiceController {

    private final SupplierInvoiceService service;

    public SupplierInvoiceController(SupplierInvoiceService service) {
        this.service = service;
    }

    /** Scanne une facture (photo ou PDF) et renvoie l'extraction + suggestions de rattachement. */
    @PostMapping("/scan")
    @ResponseStatus(HttpStatus.CREATED)
    public InvoiceResponse scan(@RequestParam("file") MultipartFile file,
                                @RequestParam(value = "etablissementId", required = false) Long etablissementId) {
        return service.scan(file, etablissementId);
    }

    @GetMapping
    public List<InvoiceSummary> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public InvoiceResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping("/{id}/apply")
    public InvoiceResponse apply(@PathVariable Long id, @Valid @RequestBody ApplyRequest request) {
        return service.apply(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    /** Sert le fichier scanné (authentifié, contrairement à /api/media qui est public). */
    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> file(@PathVariable Long id) {
        ScanFile scan = service.loadScan(id);
        long length;
        try {
            length = Files.size(scan.path());
        } catch (IOException e) {
            throw new UncheckedIOException("Lecture du fichier impossible", e);
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(scan.mime()))
                .contentLength(length)
                .body(new PathResource(scan.path()));
    }
}
