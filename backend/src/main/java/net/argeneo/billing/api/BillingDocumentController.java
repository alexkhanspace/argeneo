package net.argeneo.billing.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.billing.api.dto.DocumentDtos.ChangeStatusRequest;
import net.argeneo.billing.api.dto.DocumentDtos.CreateDocumentRequest;
import net.argeneo.billing.api.dto.DocumentDtos.DocumentResponse;
import net.argeneo.billing.api.dto.DocumentDtos.UpdateDocumentRequest;
import net.argeneo.billing.domain.DocumentType;
import net.argeneo.billing.pdf.BillingPdfService;
import net.argeneo.billing.service.BillingDocumentService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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

/** Documents de facturation : devis & factures (parcours Patron). */
@RestController
@RequestMapping("/api/billing/documents")
@PreAuthorize("hasRole('PATRON')")
public class BillingDocumentController {

    private final BillingDocumentService service;
    private final BillingPdfService pdfService;

    public BillingDocumentController(BillingDocumentService service, BillingPdfService pdfService) {
        this.service = service;
        this.pdfService = pdfService;
    }

    @GetMapping
    public List<DocumentResponse> list(@RequestParam(required = false) DocumentType type) {
        return service.list(type);
    }

    @GetMapping("/{id}")
    public DocumentResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse create(@Valid @RequestBody CreateDocumentRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public DocumentResponse update(@PathVariable Long id,
                                   @Valid @RequestBody UpdateDocumentRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @PostMapping("/{id}/status")
    public DocumentResponse changeStatus(@PathVariable Long id,
                                         @Valid @RequestBody ChangeStatusRequest request) {
        return service.changeStatus(id, request);
    }

    @PostMapping("/{id}/convert")
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse convert(@PathVariable Long id) {
        return service.convertDevisToFacture(id);
    }

    /** PDF/A-3 du document (Factur-X EN16931 embarqué pour les factures). */
    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable Long id) {
        BillingPdfService.Pdf pdf = pdfService.generate(id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(pdf.filename()).build());
        return new ResponseEntity<>(pdf.bytes(), headers, HttpStatus.OK);
    }
}
