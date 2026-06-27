package net.argeneo.billing.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import net.argeneo.billing.api.dto.DocumentDtos.ChangeStatusRequest;
import net.argeneo.billing.api.dto.DocumentDtos.CreateDocumentRequest;
import net.argeneo.billing.api.dto.DocumentDtos.DocumentResponse;
import net.argeneo.billing.api.dto.DocumentDtos.LineRequest;
import net.argeneo.billing.api.dto.DocumentDtos.UpdateDocumentRequest;
import net.argeneo.billing.domain.BillingDocument;
import net.argeneo.billing.domain.BillingDocumentLine;
import net.argeneo.billing.domain.Client;
import net.argeneo.billing.domain.DocumentStatus;
import net.argeneo.billing.domain.DocumentType;
import net.argeneo.billing.repository.BillingDocumentRepository;
import net.argeneo.billing.repository.ClientRepository;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Gestion des documents de facturation (devis / factures) : CRUD, totaux, statuts, conversion. */
@Service
public class BillingDocumentService {

    private final BillingDocumentRepository repository;
    private final ClientRepository clientRepository;
    private final BillingContext context;

    public BillingDocumentService(BillingDocumentRepository repository,
                                  ClientRepository clientRepository,
                                  BillingContext context) {
        this.repository = repository;
        this.clientRepository = clientRepository;
        this.context = context;
    }

    @Transactional(readOnly = true)
    public List<DocumentResponse> list(DocumentType type) {
        List<BillingDocument> docs = type == null
                ? repository.findAllByOrderByCreatedAtDesc()
                : repository.findByTypeOrderByCreatedAtDesc(type);
        Map<Long, String> names = clientNames();
        return docs.stream()
                .map(d -> DocumentResponse.from(d, names.get(d.getClientId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public DocumentResponse get(Long id) {
        BillingDocument doc = require(id);
        return DocumentResponse.from(doc, clientName(doc.getClientId()));
    }

    @Transactional
    public DocumentResponse create(CreateDocumentRequest request) {
        Client client = requireClient(request.clientId());
        BillingDocument doc = new BillingDocument();
        doc.setType(request.type());
        doc.setEtablissementId(context.currentEtablissementId(null));
        doc.setClientId(client.getId());
        doc.setIssueDate(request.issueDate());
        doc.setDueDate(request.dueDate());
        doc.setNotes(request.notes());
        doc.setTerms(request.terms());
        applyLines(doc, request.lines());
        recompute(doc);
        return DocumentResponse.from(repository.save(doc), client.getName());
    }

    @Transactional
    public DocumentResponse update(Long id, UpdateDocumentRequest request) {
        BillingDocument doc = require(id);
        Client client = requireClient(request.clientId());
        doc.setClientId(client.getId());
        doc.setIssueDate(request.issueDate());
        doc.setDueDate(request.dueDate());
        doc.setNotes(request.notes());
        doc.setTerms(request.terms());
        doc.getLines().clear();
        applyLines(doc, request.lines());
        recompute(doc);
        return DocumentResponse.from(repository.save(doc), client.getName());
    }

    @Transactional
    public void delete(Long id) {
        BillingDocument doc = require(id);
        if (doc.getStatus() != DocumentStatus.BROUILLON) {
            throw new ConflictException("Seul un brouillon peut être supprimé.");
        }
        repository.delete(doc);
    }

    @Transactional
    public DocumentResponse changeStatus(Long id, ChangeStatusRequest request) {
        BillingDocument doc = require(id);
        DocumentStatus target = request.status();
        if (target == DocumentStatus.EMIS && doc.getNumber() == null) {
            doc.setNumber(nextNumber(doc.getType()));
            if (doc.getIssueDate() == null) {
                doc.setIssueDate(LocalDate.now());
            }
        }
        doc.setStatus(target);
        return DocumentResponse.from(repository.save(doc), clientName(doc.getClientId()));
    }

    /** Copie un DEVIS en une nouvelle FACTURE (brouillon, lignes recopiées). */
    @Transactional
    public DocumentResponse convertDevisToFacture(Long id) {
        BillingDocument devis = require(id);
        if (devis.getType() != DocumentType.DEVIS) {
            throw new ConflictException("Seul un devis peut être converti en facture.");
        }
        BillingDocument facture = new BillingDocument();
        facture.setType(DocumentType.FACTURE);
        facture.setEtablissementId(devis.getEtablissementId());
        facture.setClientId(devis.getClientId());
        facture.setIssueDate(LocalDate.now());
        facture.setDueDate(devis.getDueDate());
        facture.setNotes(devis.getNotes());
        facture.setTerms(devis.getTerms());
        for (BillingDocumentLine src : devis.getLines()) {
            BillingDocumentLine line = new BillingDocumentLine();
            line.setPosition(src.getPosition());
            line.setDesignation(src.getDesignation());
            line.setArticleId(src.getArticleId());
            line.setQuantity(src.getQuantity());
            line.setUnit(src.getUnit());
            line.setUnitPriceHt(src.getUnitPriceHt());
            line.setVatRate(src.getVatRate());
            line.setDiscountRate(src.getDiscountRate());
            facture.getLines().add(line);
        }
        recompute(facture);
        return DocumentResponse.from(repository.save(facture), clientName(facture.getClientId()));
    }

    // --- internes ---

    private void applyLines(BillingDocument doc, List<LineRequest> lines) {
        if (lines == null) {
            return;
        }
        int position = 1;
        for (LineRequest req : lines) {
            BillingDocumentLine line = new BillingDocumentLine();
            line.setPosition(position++);
            line.setDesignation(req.designation());
            line.setArticleId(req.articleId());
            line.setQuantity(req.quantity() != null ? req.quantity() : BigDecimal.ONE);
            line.setUnit(req.unit());
            line.setUnitPriceHt(req.unitPriceHt() != null ? req.unitPriceHt() : BigDecimal.ZERO);
            line.setVatRate(req.vatRate() != null ? req.vatRate() : BigDecimal.ZERO);
            line.setDiscountRate(req.discountRate() != null ? req.discountRate() : BigDecimal.ZERO);
            doc.getLines().add(line);
        }
    }

    /** Recalcule les totaux par ligne et du document (HT / TVA / TTC). */
    private void recompute(BillingDocument doc) {
        BigDecimal totalHt = BigDecimal.ZERO;
        BigDecimal totalVat = BigDecimal.ZERO;
        for (BillingDocumentLine line : doc.getLines()) {
            BigDecimal qty = nz(line.getQuantity());
            BigDecimal pu = nz(line.getUnitPriceHt());
            BigDecimal discount = nz(line.getDiscountRate());
            BigDecimal vat = nz(line.getVatRate());
            BigDecimal lineHt = qty.multiply(pu)
                    .multiply(BigDecimal.ONE.subtract(discount))
                    .setScale(2, RoundingMode.HALF_UP);
            line.setLineTotalHt(lineHt);
            totalHt = totalHt.add(lineHt);
            totalVat = totalVat.add(lineHt.multiply(vat));
        }
        totalVat = totalVat.setScale(2, RoundingMode.HALF_UP);
        totalHt = totalHt.setScale(2, RoundingMode.HALF_UP);
        doc.setTotalHt(totalHt);
        doc.setTotalVat(totalVat);
        doc.setTotalTtc(totalHt.add(totalVat).setScale(2, RoundingMode.HALF_UP));
    }

    /** Numérotation simple : DEV-AAAA-XXXX / FAC-AAAA-XXXX. */
    private String nextNumber(DocumentType type) {
        int year = Year.now().getValue();
        String prefix = type == DocumentType.FACTURE ? "FAC" : "DEV";
        long count = repository.findByTypeOrderByCreatedAtDesc(type).stream()
                .filter(d -> d.getNumber() != null
                        && d.getNumber().startsWith(prefix + "-" + year + "-"))
                .count();
        return String.format("%s-%d-%04d", prefix, year, count + 1);
    }

    private BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private BillingDocument require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document introuvable : " + id));
    }

    private Client requireClient(Long clientId) {
        return clientRepository.findById(clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client introuvable : " + clientId));
    }

    private String clientName(Long clientId) {
        return clientRepository.findById(clientId).map(Client::getName).orElse(null);
    }

    private Map<Long, String> clientNames() {
        Map<Long, String> names = new HashMap<>();
        for (Client c : clientRepository.findAll()) {
            names.put(c.getId(), c.getName());
        }
        return names;
    }
}
