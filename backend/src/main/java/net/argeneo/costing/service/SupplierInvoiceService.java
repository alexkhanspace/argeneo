package net.argeneo.costing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import net.argeneo.audit.AuditService;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.config.ArgeneoProperties;
import net.argeneo.costing.api.dto.InvoiceDtos.ApplyLine;
import net.argeneo.costing.api.dto.InvoiceDtos.ApplyRequest;
import net.argeneo.costing.api.dto.InvoiceDtos.InvoiceLineResponse;
import net.argeneo.costing.api.dto.InvoiceDtos.InvoiceResponse;
import net.argeneo.costing.api.dto.InvoiceDtos.InvoiceSummary;
import net.argeneo.costing.domain.Unit;
import net.argeneo.costing.entity.FamilleScope;
import net.argeneo.costing.entity.RawMaterial;
import net.argeneo.costing.entity.SupplierInvoice;
import net.argeneo.costing.entity.SupplierInvoiceLine;
import net.argeneo.costing.entity.SupplierInvoiceStatus;
import net.argeneo.costing.repository.RawMaterialRepository;
import net.argeneo.costing.repository.SupplierInvoiceRepository;
import net.argeneo.insights.GeminiClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Scan de factures fournisseurs : extraction IA (Gemini), archivage compta et mise à jour
 * des prix des matières premières après revue du patron.
 */
@Service
public class SupplierInvoiceService {

    private static final MathContext MC = MathContext.DECIMAL128;
    // Instance locale : pas de bean ObjectMapper à injecter, et le parsing en arbre (readTree)
    // ne dépend d'aucune configuration particulière.
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String PROMPT = """
            Tu es un assistant comptable. Analyse cette FACTURE FOURNISSEUR (boulangerie-pâtisserie / restauration)
            et renvoie UNIQUEMENT un objet JSON valide, sans texte autour, avec exactement cette forme :
            {
              "supplierName": string|null,
              "invoiceNumber": string|null,
              "invoiceDate": "AAAA-MM-JJ"|null,
              "totalHt": number|null,
              "totalVat": number|null,
              "totalTtc": number|null,
              "lines": [
                {
                  "designation": string,
                  "quantity": number|null,
                  "unit": string|null,
                  "unitPriceHt": number|null,
                  "lineTotalHt": number|null,
                  "vatRate": number|null
                }
              ]
            }
            Règles :
            - Ne mets dans "lines" que les articles/marchandises achetés (une ligne par produit). Ignore les
              lignes de sous-total, remise globale, acompte, transport/frais de port et éco-participation.
            - Montants en euros, HT de préférence, avec un POINT décimal (jamais de virgule, pas de symbole €).
            - "unit" = l'unité d'achat telle qu'écrite (ex. "kg", "g", "L", "ml", "sac", "carton", "pièce", "u").
            - "vatRate" en fraction décimale si visible (0.055, 0.10, 0.20), sinon null.
            - Si une valeur est illisible ou absente, mets null. N'invente rien.
            """;

    private final SupplierInvoiceRepository repository;
    private final RawMaterialRepository materialRepository;
    private final FamilleService familleService;
    private final GeminiClient gemini;
    private final AuditService audit;
    private final Path uploadDir;

    public SupplierInvoiceService(SupplierInvoiceRepository repository,
                                  RawMaterialRepository materialRepository,
                                  FamilleService familleService,
                                  GeminiClient gemini,
                                  AuditService audit,
                                  ArgeneoProperties properties) {
        this.repository = repository;
        this.materialRepository = materialRepository;
        this.familleService = familleService;
        this.gemini = gemini;
        this.audit = audit;
        this.uploadDir = Path.of(properties.uploads().dir());
    }

    @PostConstruct
    void ensureDir() {
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new UncheckedIOException("Impossible de créer le dossier d'upload : " + uploadDir, e);
        }
    }

    /** Scanne une facture : stocke le fichier, extrait les données par IA et persiste un brouillon. */
    @Transactional
    public InvoiceResponse scan(MultipartFile file, Long etablissementId) {
        if (!gemini.isConfigured()) {
            throw new ConflictException("Analyse IA non configurée sur ce serveur.");
        }
        if (file == null || file.isEmpty()) {
            throw new ConflictException("Fichier vide.");
        }
        String mime = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        byte[] bytes;
        String stored;
        try {
            bytes = file.getBytes();
            stored = UUID.randomUUID().toString().replace("-", "") + extension(file.getOriginalFilename(), mime);
            Files.copy(file.getInputStream(), uploadDir.resolve(stored), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("Échec de l'écriture du fichier", e);
        }

        SupplierInvoice invoice = new SupplierInvoice();
        invoice.setEtablissementId(etablissementId);
        invoice.setScanFile(stored);
        invoice.setScanMime(mime);
        invoice.setStatus(SupplierInvoiceStatus.NOUVEAU);

        String json = gemini.extractStructured(bytes, mime, PROMPT);
        parseInto(invoice, json);

        SupplierInvoice saved = repository.save(invoice);
        audit.record("INVOICE_SCAN", "SUPPLIER_INVOICE", saved.getId(),
                "Facture " + nullToDash(saved.getSupplierName()) + " (" + saved.getLines().size() + " lignes)");
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<InvoiceSummary> list() {
        return repository.findAllByOrderByCreatedAtDesc().stream().map(inv -> {
            int applied = (int) inv.getLines().stream().filter(SupplierInvoiceLine::isApplied).count();
            return new InvoiceSummary(inv.getId(), inv.getSupplierName(), inv.getInvoiceNumber(),
                    inv.getInvoiceDate(), inv.getTotalHt(), inv.getTotalTtc(), inv.getStatus(),
                    inv.getLines().size(), applied, inv.getScanFile() != null, inv.getCreatedAt());
        }).toList();
    }

    @Transactional(readOnly = true)
    public InvoiceResponse get(Long id) {
        return toResponse(require(id));
    }

    /** Applique les décisions de revue : met à jour / crée les MP et marque la facture traitée. */
    @Transactional
    public InvoiceResponse apply(Long id, ApplyRequest request) {
        SupplierInvoice invoice = require(id);
        Map<Long, SupplierInvoiceLine> byId = invoice.getLines().stream()
                .collect(java.util.stream.Collectors.toMap(SupplierInvoiceLine::getId, l -> l));

        boolean anyApplied = false;
        for (ApplyLine a : request.lines()) {
            SupplierInvoiceLine line = byId.get(a.lineId());
            if (line == null) {
                continue;
            }
            switch (a.action()) {
                case SKIP -> { /* rien */ }
                case UPDATE -> {
                    if (a.rawMaterialId() == null || a.pricePerUnit() == null) {
                        throw new ConflictException("Ligne « " + line.getDesignation()
                                + " » : matière et prix requis pour la mise à jour.");
                    }
                    RawMaterial mat = materialRepository.findById(a.rawMaterialId())
                            .orElseThrow(() -> new ResourceNotFoundException(
                                    "Matière première introuvable : " + a.rawMaterialId()));
                    mat.setPricePerUnit(a.pricePerUnit());
                    materialRepository.save(mat);
                    markApplied(line, mat.getId(), a.pricePerUnit());
                    anyApplied = true;
                }
                case CREATE -> {
                    if (a.newName() == null || a.newName().isBlank() || a.newReferenceUnit() == null
                            || a.pricePerUnit() == null) {
                        throw new ConflictException("Ligne « " + line.getDesignation()
                                + " » : nom, unité et prix requis pour créer la matière.");
                    }
                    familleService.validateAssignment(FamilleScope.RAW_MATERIAL, a.familleId(), a.sousFamilleId());
                    RawMaterial mat = new RawMaterial();
                    mat.setName(a.newName().trim());
                    mat.setReferenceUnit(a.newReferenceUnit());
                    mat.setPricePerUnit(a.pricePerUnit());
                    mat.setFamilleId(a.familleId());
                    mat.setSousFamilleId(a.sousFamilleId());
                    RawMaterial created = materialRepository.save(mat);
                    markApplied(line, created.getId(), a.pricePerUnit());
                    anyApplied = true;
                }
                default -> { /* exhaustif */ }
            }
        }

        if (anyApplied) {
            invoice.setStatus(SupplierInvoiceStatus.TRAITEE);
            invoice.setAppliedAt(Instant.now());
        }
        SupplierInvoice saved = repository.save(invoice);
        audit.record("INVOICE_APPLY", "SUPPLIER_INVOICE", saved.getId(),
                "Facture " + nullToDash(saved.getSupplierName()) + " appliquée aux matières");
        return toResponse(saved);
    }

    @Transactional
    public void delete(Long id) {
        SupplierInvoice invoice = require(id);
        deleteScanFile(invoice.getScanFile());
        repository.delete(invoice);
        audit.record("INVOICE_DELETE", "SUPPLIER_INVOICE", id,
                "Facture " + nullToDash(invoice.getSupplierName()));
    }

    /** Fichier scanné (chemin + type) pour le streaming authentifié par le contrôleur. */
    @Transactional(readOnly = true)
    public ScanFile loadScan(Long id) {
        SupplierInvoice invoice = require(id);
        if (invoice.getScanFile() == null) {
            throw new ResourceNotFoundException("Aucun fichier pour cette facture.");
        }
        Path path = uploadDir.resolve(invoice.getScanFile()).normalize();
        if (!path.startsWith(uploadDir.normalize()) || !Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("Fichier introuvable.");
        }
        return new ScanFile(path, invoice.getScanMime() != null ? invoice.getScanMime() : "application/octet-stream");
    }

    public record ScanFile(Path path, String mime) {
    }

    // ---------------------------------------------------------------------
    // Extraction / parsing
    // ---------------------------------------------------------------------

    private void parseInto(SupplierInvoice invoice, String json) {
        JsonNode root = readJson(json);
        if (root == null) {
            return; // facture archivée mais sans lignes : le patron pourra re-scanner ou supprimer
        }
        invoice.setSupplierName(text(root, "supplierName"));
        invoice.setInvoiceNumber(text(root, "invoiceNumber"));
        invoice.setInvoiceDate(parseDate(text(root, "invoiceDate")));
        invoice.setTotalHt(num(root, "totalHt"));
        invoice.setTotalVat(num(root, "totalVat"));
        invoice.setTotalTtc(num(root, "totalTtc"));

        JsonNode lines = root.get("lines");
        if (lines != null && lines.isArray()) {
            int pos = 0;
            for (JsonNode l : lines) {
                String designation = text(l, "designation");
                if (designation == null || designation.isBlank()) {
                    continue;
                }
                SupplierInvoiceLine line = new SupplierInvoiceLine();
                line.setPosition(pos++);
                line.setDesignation(designation.length() > 500 ? designation.substring(0, 500) : designation);
                line.setQuantity(num(l, "quantity"));
                line.setUnit(text(l, "unit"));
                line.setUnitPriceHt(num(l, "unitPriceHt"));
                line.setLineTotalHt(num(l, "lineTotalHt"));
                line.setVatRate(num(l, "vatRate"));
                invoice.getLines().add(line);
            }
        }
    }

    private JsonNode readJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim();
        // Retire d'éventuelles clôtures markdown ```json ... ```
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            if (nl >= 0) {
                s = s.substring(nl + 1);
            }
            if (s.endsWith("```")) {
                s = s.substring(0, s.length() - 3);
            }
        }
        try {
            return MAPPER.readTree(s);
        } catch (IOException e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        String s = v.asText().trim();
        return s.isEmpty() || "null".equalsIgnoreCase(s) ? null : s;
    }

    /** Lit un nombre, tolérant aux montants en chaîne (« 12,50 €», espaces, virgule décimale). */
    private static BigDecimal num(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        if (v.isNumber()) {
            return v.decimalValue();
        }
        String s = v.asText().trim()
                .replace(" ", "")
                .replace(" ", "")
                .replace("€", "")
                .replace(",", ".");
        if (s.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate parseDate(String s) {
        if (s == null) {
            return null;
        }
        for (DateTimeFormatter f : List.of(
                DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                DateTimeFormatter.ofPattern("dd-MM-yyyy"),
                DateTimeFormatter.ofPattern("dd.MM.yyyy"))) {
            try {
                return LocalDate.parse(s, f);
            } catch (Exception ignored) {
                // format suivant
            }
        }
        return null;
    }

    // ---------------------------------------------------------------------
    // Réponses + suggestions de rattachement aux MP
    // ---------------------------------------------------------------------

    private InvoiceResponse toResponse(SupplierInvoice inv) {
        List<RawMaterial> materials = materialRepository.findAllByOrderByNameAsc();
        List<InvoiceLineResponse> lines = inv.getLines().stream()
                .map(l -> lineResponse(l, materials))
                .toList();
        return new InvoiceResponse(inv.getId(), inv.getEtablissementId(), inv.getSupplierName(),
                inv.getInvoiceNumber(), inv.getInvoiceDate(), inv.getTotalHt(), inv.getTotalVat(),
                inv.getTotalTtc(), inv.getScanFile() != null, inv.getStatus(), inv.getCreatedAt(),
                inv.getAppliedAt(), lines);
    }

    private InvoiceLineResponse lineResponse(SupplierInvoiceLine l, List<RawMaterial> materials) {
        RawMaterial match = bestMatch(l.getDesignation(), materials);
        Unit parsed = parseUnit(l.getUnit());
        Unit refUnit = match != null ? match.getReferenceUnit() : parsed;
        BigDecimal suggestedPrice = pricePerRefUnit(l, parsed, refUnit);
        return new InvoiceLineResponse(
                l.getId(), l.getPosition(), l.getDesignation(), l.getQuantity(), l.getUnit(),
                l.getUnitPriceHt(), l.getLineTotalHt(), l.getVatRate(),
                l.isApplied(), l.getRawMaterialId(), l.getAppliedPricePerUnit(),
                match != null ? match.getId() : null,
                match != null ? match.getName() : null,
                refUnit, suggestedPrice);
    }

    /** Prix par unité de référence quand l'unité facture est convertible vers l'unité MP. */
    private static BigDecimal pricePerRefUnit(SupplierInvoiceLine l, Unit parsed, Unit refUnit) {
        if (parsed == null || refUnit == null || parsed.dimension() != refUnit.dimension()) {
            return null;
        }
        BigDecimal qty = l.getQuantity();
        if (qty == null || qty.signum() <= 0) {
            return null;
        }
        BigDecimal total = l.getLineTotalHt();
        if (total == null && l.getUnitPriceHt() != null) {
            total = l.getUnitPriceHt().multiply(qty, MC);
        }
        if (total == null) {
            return null;
        }
        BigDecimal qtyInRef = parsed.convert(qty, refUnit, MC);
        if (qtyInRef.signum() == 0) {
            return null;
        }
        return total.divide(qtyInRef, 4, RoundingMode.HALF_UP);
    }

    /** Association simple par nom normalisé (inclusion d'un libellé dans l'autre). */
    private static RawMaterial bestMatch(String designation, List<RawMaterial> materials) {
        String d = normalize(designation);
        if (d.isEmpty()) {
            return null;
        }
        RawMaterial best = null;
        int bestLen = 0;
        for (RawMaterial m : materials) {
            String n = normalize(m.getName());
            if (n.isEmpty()) {
                continue;
            }
            if ((d.contains(n) || n.contains(d)) && n.length() > bestLen) {
                best = m;
                bestLen = n.length();
            }
        }
        return best;
    }

    private static String normalize(String s) {
        if (s == null) {
            return "";
        }
        String n = Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9 ]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return n;
    }

    /** Reconnaît l'unité d'achat parmi les unités gérées (sinon null → conversion impossible). */
    private static Unit parseUnit(String raw) {
        if (raw == null) {
            return null;
        }
        String u = normalize(raw);
        return switch (u) {
            case "kg", "kilo", "kilos", "kilogramme", "kilogrammes" -> Unit.KG;
            case "g", "gr", "gramme", "grammes" -> Unit.G;
            case "l", "litre", "litres" -> Unit.L;
            case "ml", "millilitre", "millilitres" -> Unit.ML;
            case "piece", "pieces", "u", "unite", "unites", "pc", "pce", "pcs" -> Unit.PIECE;
            default -> null;
        };
    }

    // ---------------------------------------------------------------------
    // Divers
    // ---------------------------------------------------------------------

    private static void markApplied(SupplierInvoiceLine line, Long rawMaterialId, BigDecimal price) {
        line.setRawMaterialId(rawMaterialId);
        line.setAppliedPricePerUnit(price);
        line.setApplied(true);
    }

    private SupplierInvoice require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Facture introuvable : " + id));
    }

    private void deleteScanFile(String name) {
        if (name == null) {
            return;
        }
        try {
            Path path = uploadDir.resolve(name).normalize();
            if (path.startsWith(uploadDir.normalize())) {
                Files.deleteIfExists(path);
            }
        } catch (IOException ignored) {
            // suppression best-effort : l'enregistrement compte plus que le fichier orphelin
        }
    }

    private static String nullToDash(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    private static String extension(String original, String mime) {
        String ext = original == null ? null
                : org.springframework.util.StringUtils.getFilenameExtension(original);
        if (ext != null) {
            ext = ext.toLowerCase(Locale.ROOT);
            if (List.of("jpg", "jpeg", "png", "webp", "pdf").contains(ext)) {
                return "." + ext;
            }
        }
        if (mime != null) {
            return switch (mime.toLowerCase(Locale.ROOT)) {
                case "image/jpeg" -> ".jpg";
                case "image/png" -> ".png";
                case "image/webp" -> ".webp";
                case "application/pdf" -> ".pdf";
                default -> "";
            };
        }
        return "";
    }
}
