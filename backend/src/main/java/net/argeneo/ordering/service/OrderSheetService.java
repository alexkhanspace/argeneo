package net.argeneo.ordering.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import net.argeneo.audit.AuditService;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.insights.GeminiClient;
import net.argeneo.ordering.api.dto.OrderingDtos.SheetLine;
import net.argeneo.ordering.api.dto.OrderingDtos.SheetLineRequest;
import net.argeneo.ordering.api.dto.OrderingDtos.SheetRequest;
import net.argeneo.ordering.api.dto.OrderingDtos.SheetResponse;
import net.argeneo.ordering.api.dto.OrderingDtos.SheetScanResult;
import net.argeneo.ordering.api.dto.OrderingDtos.SheetSummary;
import net.argeneo.ordering.entity.OrderSheet;
import net.argeneo.ordering.entity.OrderSheetLine;
import net.argeneo.ordering.repository.OrderSheetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Cadenciers fournisseurs : création, édition et import par IA d'un cadencier papier. */
@Service
public class OrderSheetService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String PROMPT = """
            Tu analyses UNE PAGE d'un CADENCIER / BON DE COMMANDE fournisseur (boulangerie, pâtisserie,
            restauration) : un tableau de produits commandables avec une colonne de quantité à remplir.
            Renvoie UNIQUEMENT un objet JSON valide, sans texte autour, de cette forme exacte :
            {
              "name": string|null,
              "supplierName": string|null,
              "lines": [
                {
                  "section": string|null,
                  "code": string|null,
                  "designation": string,
                  "designationAlt": string|null,
                  "packaging": string|null,
                  "unitPrice": number|null,
                  "priceUnit": string|null
                }
              ]
            }
            Règles :
            - "name" : titre du document (ex. « Bon de commande BAKO », « Cadencier Boulangerie Riclin Gare CGA »).
              "supplierName" : le fournisseur (ex. « BAKO », « CGA », « Moulin Roos », « Coop »), sinon null.
            - Une entrée dans "lines" par LIGNE PRODUIT du tableau, DANS L'ORDRE de lecture (de haut en bas ;
              si la page a plusieurs tableaux côte à côte, celui de gauche entièrement puis celui de droite).
            - Garde les lignes produit même sans prix ni code. Ignore les en-têtes de colonnes, les totaux,
              les cases à cocher (lieux de livraison), la date et les lignes entièrement vides.
            - "designation" : libellé principal en FRANÇAIS tel qu'écrit. Si le tableau a deux colonnes de
              libellé (ex. allemand + français), mets le français dans "designation" et l'autre dans
              "designationAlt". Recopie les références numériques présentes dans le libellé.
            - "code" : code / référence article s'il y a une colonne dédiée (ex. « DG4600 »), sinon null ;
              « - » vaut null.
            - "packaging" : conditionnement tel qu'écrit (ex. « 4x2,5kg », « 25 kg », « Sac », « Palette »,
              « Bidon 5 L », « 50 St »).
            - "unitPrice" : prix unitaire avec un POINT décimal, sans symbole (ex. 6.69). Si deux prix figurent
              (ex. « 6,19 / 3,59 € »), prends le premier. "priceUnit" : unité du prix si indiquée dans
              l'en-tête (« Preis/kg » -> "kg", « Prix/colis » -> "colis"), sinon null.
            - "section" : intertitre de rubrique éventuel qui précède un groupe de lignes, sinon null.
            - N'invente rien : valeur illisible ou absente -> null. La colonne quantité (vide) est ignorée.
            """;

    private final OrderSheetRepository repository;
    private final GeminiClient gemini;
    private final AuditService audit;

    public OrderSheetService(OrderSheetRepository repository, GeminiClient gemini, AuditService audit) {
        this.repository = repository;
        this.gemini = gemini;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<SheetSummary> list() {
        return repository.findAllByOrderByNameAsc().stream()
                .map(s -> new SheetSummary(s.getId(), s.getName(), s.getSupplierName(), s.isActive(),
                        s.getLines().size(), s.getUpdatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public SheetResponse get(Long id) {
        return toResponse(require(id));
    }

    @Transactional
    public SheetResponse create(SheetRequest request) {
        OrderSheet sheet = new OrderSheet();
        apply(sheet, request);
        OrderSheet saved = repository.save(sheet);
        audit.record("ORDER_SHEET_CREATE", "ORDER_SHEET", saved.getId(),
                "Cadencier « " + saved.getName() + " » (" + saved.getLines().size() + " produits)");
        return toResponse(saved);
    }

    @Transactional
    public SheetResponse update(Long id, SheetRequest request) {
        OrderSheet sheet = require(id);
        apply(sheet, request);
        OrderSheet saved = repository.save(sheet);
        audit.record("ORDER_SHEET_UPDATE", "ORDER_SHEET", saved.getId(), "Cadencier « " + saved.getName() + " »");
        return toResponse(saved);
    }

    @Transactional
    public void delete(Long id) {
        OrderSheet sheet = require(id);
        repository.delete(sheet);
        audit.record("ORDER_SHEET_DELETE", "ORDER_SHEET", id, "Cadencier « " + sheet.getName() + " »");
    }

    /**
     * Lit UNE page de cadencier (photo ou PDF) par IA. Rien n'est enregistré : le client fusionne
     * les pages puis relit le brouillon avant de créer le cadencier.
     */
    public SheetScanResult scan(MultipartFile file) {
        if (!gemini.isConfigured()) {
            throw new ConflictException("Analyse IA non configurée sur ce serveur.");
        }
        if (file == null || file.isEmpty()) {
            throw new ConflictException("Fichier vide.");
        }
        String mime = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Lecture du fichier impossible", e);
        }
        JsonNode root = readJson(gemini.extractStructured(bytes, mime, PROMPT));
        if (root == null) {
            throw new ConflictException("Le cadencier n'a pas pu être lu. Reprenez la photo bien à plat et nette.");
        }
        List<SheetLine> lines = new ArrayList<>();
        JsonNode arr = root.get("lines");
        if (arr != null && arr.isArray()) {
            for (JsonNode l : arr) {
                String designation = cut(text(l, "designation"), 300);
                if (designation == null) {
                    continue;
                }
                lines.add(new SheetLine(null, cut(text(l, "section"), 120), cut(text(l, "code"), 60),
                        designation, cut(text(l, "designationAlt"), 300), cut(text(l, "packaging"), 120),
                        num(l, "unitPrice"), cut(text(l, "priceUnit"), 30), null));
            }
        }
        audit.record("ORDER_SHEET_SCAN", "ORDER_SHEET", null, "Import cadencier (" + lines.size() + " lignes)");
        return new SheetScanResult(cut(text(root, "name"), 150), cut(text(root, "supplierName"), 255), 1, lines);
    }

    // ---------------------------------------------------------------------

    private void apply(OrderSheet sheet, SheetRequest r) {
        sheet.setName(r.name().trim());
        sheet.setSupplierName(blankToNull(r.supplierName()));
        sheet.setSupplierEmail(blankToNull(r.supplierEmail()));
        sheet.setSupplierPhone(blankToNull(r.supplierPhone()));
        sheet.setNotes(blankToNull(r.notes()));
        sheet.setColor(r.color() != null && r.color().matches("^#[0-9a-fA-F]{6}$") ? r.color() : null);
        if (r.showPrices() != null) {
            sheet.setShowPrices(r.showPrices());
        }
        if (r.active() != null) {
            sheet.setActive(r.active());
        }
        if (r.deliveryDateChoice() != null) {
            sheet.setDeliveryDateChoice(r.deliveryDateChoice());
        }
        sheet.setDeliveryDays(blankToNull(r.deliveryDays()));
        // Lignes : on remplace la liste en réutilisant les entités par id, pour garder les ids
        // (référencés par les commandes en cours) même si l'ordre change.
        java.util.Map<Long, OrderSheetLine> existing = new java.util.HashMap<>();
        sheet.getLines().forEach(l -> existing.put(l.getId(), l));
        sheet.getLines().clear();
        int pos = 0;
        for (SheetLineRequest l : r.lines()) {
            OrderSheetLine found = l.id() != null ? existing.remove(l.id()) : null;
            OrderSheetLine line = found != null ? found : new OrderSheetLine();
            line.setPosition(pos++);
            line.setSection(blankToNull(l.section()));
            line.setCode(blankToNull(l.code()));
            line.setDesignation(l.designation().trim());
            line.setDesignationAlt(blankToNull(l.designationAlt()));
            line.setPackaging(blankToNull(l.packaging()));
            line.setUnitPrice(l.unitPrice());
            line.setPriceUnit(blankToNull(l.priceUnit()));
            line.setRawMaterialId(l.rawMaterialId());
            sheet.getLines().add(line);
        }
    }

    /** Jours de livraison par cadencier (pour calculer les réceptions attendues). */
    @Transactional(readOnly = true)
    public java.util.Map<Long, String> deliveryDaysById() {
        java.util.Map<Long, String> map = new java.util.HashMap<>();
        repository.findAll().forEach(s -> map.put(s.getId(), s.getDeliveryDays()));
        return map;
    }

    OrderSheet require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cadencier introuvable : " + id));
    }

    private static SheetResponse toResponse(OrderSheet s) {
        List<SheetLine> lines = s.getLines().stream()
                .map(l -> new SheetLine(l.getId(), l.getSection(), l.getCode(), l.getDesignation(),
                        l.getDesignationAlt(), l.getPackaging(), l.getUnitPrice(), l.getPriceUnit(),
                        l.getRawMaterialId()))
                .toList();
        return new SheetResponse(s.getId(), s.getName(), s.getSupplierName(), s.getSupplierEmail(),
                s.getSupplierPhone(), s.getNotes(), s.getColor(), s.isShowPrices(), s.isActive(),
                s.isDeliveryDateChoice(), s.getDeliveryDays(), s.getUpdatedAt(), lines);
    }

    private static JsonNode readJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim();
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
        return s.isEmpty() || "null".equalsIgnoreCase(s) || "-".equals(s) ? null : s;
    }

    /** Nombre tolérant (« 6,69 € », espaces, virgule décimale). */
    private static BigDecimal num(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        if (v.isNumber()) {
            return v.decimalValue();
        }
        String s = v.asText().replaceAll("[\\s €]", "").replace(",", ".");
        int slash = s.indexOf('/');
        if (slash > 0) {
            s = s.substring(0, slash);
        }
        try {
            return s.isEmpty() ? null : new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String cut(String s, int max) {
        return s == null ? null : s.length() > max ? s.substring(0, max) : s;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
