package net.argeneo.ordering.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import net.argeneo.audit.AuditService;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.iam.domain.Etablissement;
import net.argeneo.iam.repository.EtablissementRepository;
import net.argeneo.ordering.api.dto.OrderingDtos.OrderLine;
import net.argeneo.ordering.api.dto.OrderingDtos.OrderLineRequest;
import net.argeneo.ordering.api.dto.OrderingDtos.OrderRequest;
import net.argeneo.ordering.api.dto.OrderingDtos.OrderResponse;
import net.argeneo.ordering.api.dto.OrderingDtos.OrderSummary;
import net.argeneo.ordering.entity.OrderSheet;
import net.argeneo.ordering.entity.OrderSheetLine;
import net.argeneo.ordering.entity.PurchaseOrder;
import net.argeneo.ordering.entity.PurchaseOrderLine;
import net.argeneo.ordering.entity.PurchaseOrderStatus;
import net.argeneo.ordering.repository.PurchaseOrderRepository;
import net.argeneo.security.AuthPrincipal;
import net.argeneo.security.CurrentUser;
import net.argeneo.security.EtablissementAccess;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Commandes fournisseurs : saisie depuis un cadencier (patron, ou employé ayant la permission
 * {@code passer_commande} sur l'établissement), validation et historique.
 */
@Service
public class PurchaseOrderService {

    public static final String PERMISSION = "passer_commande";

    private final PurchaseOrderRepository repository;
    private final OrderSheetService sheetService;
    private final EtablissementRepository etablissementRepository;
    private final EtablissementAccess access;
    private final AuditService audit;

    public PurchaseOrderService(PurchaseOrderRepository repository,
                                OrderSheetService sheetService,
                                EtablissementRepository etablissementRepository,
                                EtablissementAccess access,
                                AuditService audit) {
        this.repository = repository;
        this.sheetService = sheetService;
        this.etablissementRepository = etablissementRepository;
        this.access = access;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<OrderSummary> list() {
        List<PurchaseOrder> orders = isPatron()
                ? repository.findTop200ByOrderByOrderDateDescIdDesc()
                : repository.findTop200ByEtablissementIdInOrderByOrderDateDescIdDesc(myOrderingEtablissements());
        Map<Long, String> names = etablissementNames();
        return orders.stream().map(o -> new OrderSummary(o.getId(), o.getSheetId(), o.getSheetName(),
                o.getSupplierName(), o.getEtablissementId(), names.get(o.getEtablissementId()),
                o.getOrderDate(), o.getDeliveryDate(), o.getStatus(),
                (int) o.getLines().stream().filter(l -> l.getQuantity().signum() > 0).count(),
                total(o), o.getCreatedByName(), o.getCreatedAt())).toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse get(Long id) {
        PurchaseOrder order = require(id);
        checkCanOrder(order.getEtablissementId());
        return toResponse(order);
    }

    @Transactional
    public OrderResponse create(OrderRequest request) {
        checkCanOrder(request.etablissementId());
        PurchaseOrder order = new PurchaseOrder();
        AuthPrincipal me = CurrentUser.require();
        order.setCreatedById(me.id());
        order.setCreatedByName(me.fullName());
        apply(order, request);
        PurchaseOrder saved = repository.save(order);
        audit.record(saved.getStatus() == PurchaseOrderStatus.VALIDEE ? "ORDER_VALIDATE" : "ORDER_CREATE",
                "PURCHASE_ORDER", saved.getId(), describe(saved));
        return toResponse(saved);
    }

    @Transactional
    public OrderResponse update(Long id, OrderRequest request) {
        PurchaseOrder order = require(id);
        checkCanOrder(order.getEtablissementId());
        checkCanOrder(request.etablissementId());
        if (order.getStatus() == PurchaseOrderStatus.VALIDEE && !isPatron()) {
            throw new ConflictException("Commande déjà validée : seul le patron peut la modifier.");
        }
        PurchaseOrderStatus before = order.getStatus();
        apply(order, request);
        PurchaseOrder saved = repository.save(order);
        audit.record(before != PurchaseOrderStatus.VALIDEE && saved.getStatus() == PurchaseOrderStatus.VALIDEE
                ? "ORDER_VALIDATE" : "ORDER_UPDATE", "PURCHASE_ORDER", saved.getId(), describe(saved));
        return toResponse(saved);
    }

    /** Repasse une commande validée en brouillon (correction) — réservé au patron par le contrôleur. */
    @Transactional
    public OrderResponse reopen(Long id) {
        PurchaseOrder order = require(id);
        order.setStatus(PurchaseOrderStatus.BROUILLON);
        order.setValidatedAt(null);
        PurchaseOrder saved = repository.save(order);
        audit.record("ORDER_REOPEN", "PURCHASE_ORDER", saved.getId(), describe(saved));
        return toResponse(saved);
    }

    @Transactional
    public void delete(Long id) {
        PurchaseOrder order = require(id);
        checkCanOrder(order.getEtablissementId());
        if (order.getStatus() == PurchaseOrderStatus.VALIDEE && !isPatron()) {
            throw new ConflictException("Commande déjà validée : seul le patron peut la supprimer.");
        }
        repository.delete(order);
        audit.record("ORDER_DELETE", "PURCHASE_ORDER", id, describe(order));
    }

    // ---------------------------------------------------------------------

    private void apply(PurchaseOrder order, OrderRequest r) {
        OrderSheet sheet = sheetService.require(r.sheetId());
        order.setSheetId(sheet.getId());
        order.setSheetName(sheet.getName());
        order.setSupplierName(sheet.getSupplierName());
        order.setEtablissementId(r.etablissementId());
        order.setOrderDate(r.orderDate() != null ? r.orderDate()
                : order.getOrderDate() != null ? order.getOrderDate() : LocalDate.now());
        order.setDeliveryDate(r.deliveryDate());
        order.setNotes(r.notes() == null || r.notes().isBlank() ? null : r.notes().trim());

        Map<Long, OrderSheetLine> sheetLines = sheet.getLines().stream()
                .collect(Collectors.toMap(OrderSheetLine::getId, Function.identity()));
        List<PurchaseOrderLine> lines = new ArrayList<>();
        for (OrderLineRequest l : r.lines()) {
            if (l.quantity() == null || l.quantity().signum() <= 0) {
                continue; // seules les quantités saisies sont conservées
            }
            PurchaseOrderLine line = new PurchaseOrderLine();
            line.setQuantity(l.quantity());
            OrderSheetLine src = l.sheetLineId() != null ? sheetLines.get(l.sheetLineId()) : null;
            if (src != null) {
                line.setSheetLineId(src.getId());
                line.setSection(src.getSection());
                line.setCode(src.getCode());
                line.setDesignation(src.getDesignation());
                line.setPackaging(src.getPackaging());
                line.setUnitPrice(src.getUnitPrice());
                line.setPriceUnit(src.getPriceUnit());
                line.setPosition(src.getPosition());
            } else if (l.designation() != null && !l.designation().isBlank()) {
                // Ligne libre (produit hors cadencier) : placée en fin de bon.
                line.setDesignation(l.designation().trim());
                line.setPackaging(l.packaging() == null || l.packaging().isBlank() ? null : l.packaging().trim());
                line.setPosition(10_000 + lines.size());
            } else {
                continue;
            }
            lines.add(line);
        }
        lines.sort(java.util.Comparator.comparing(PurchaseOrderLine::getPosition));
        order.getLines().clear();
        order.getLines().addAll(lines);

        if (Boolean.TRUE.equals(r.validate())) {
            if (lines.isEmpty()) {
                throw new ConflictException("Commande vide : saisissez au moins une quantité.");
            }
            if (order.getStatus() != PurchaseOrderStatus.VALIDEE) {
                order.setStatus(PurchaseOrderStatus.VALIDEE);
                order.setValidatedAt(Instant.now());
            }
        }
    }

    private OrderResponse toResponse(PurchaseOrder o) {
        List<OrderLine> lines = o.getLines().stream()
                .map(l -> new OrderLine(l.getId(), l.getSheetLineId(), l.getSection(), l.getCode(),
                        l.getDesignation(), l.getPackaging(), l.getUnitPrice(), l.getPriceUnit(), l.getQuantity()))
                .toList();
        String etabName = o.getEtablissementId() == null ? null
                : etablissementRepository.findById(o.getEtablissementId()).map(Etablissement::getName).orElse(null);
        return new OrderResponse(o.getId(), o.getSheetId(), o.getSheetName(), o.getSupplierName(),
                o.getEtablissementId(), etabName, o.getOrderDate(), o.getDeliveryDate(), o.getStatus(),
                o.getNotes(), o.getCreatedByName(), o.getCreatedAt(), o.getValidatedAt(), total(o), lines);
    }

    /**
     * Montant indicatif : quantité × prix, uniquement quand le prix est par colis/unité commandée
     * (un prix « au kg » sur un colis de 4 × 2,5 kg ne se multiplie pas directement) — sinon null.
     */
    private static BigDecimal total(PurchaseOrder o) {
        BigDecimal sum = BigDecimal.ZERO;
        boolean any = false;
        for (PurchaseOrderLine l : o.getLines()) {
            if (l.getUnitPrice() == null || l.getPriceUnit() != null) {
                continue;
            }
            sum = sum.add(l.getUnitPrice().multiply(l.getQuantity()));
            any = true;
        }
        return any ? sum.setScale(2, java.math.RoundingMode.HALF_UP) : null;
    }

    private Map<Long, String> etablissementNames() {
        return etablissementRepository.findAll().stream()
                .collect(Collectors.toMap(Etablissement::getId, Etablissement::getName));
    }

    private void checkCanOrder(Long etablissementId) {
        if (etablissementId == null) {
            if (isPatron()) {
                return;
            }
            throw new AccessDeniedException("Accès refusé");
        }
        if (!access.has(etablissementId, PERMISSION)) {
            throw new AccessDeniedException("Vous n'avez pas le droit de commander pour cet établissement.");
        }
    }

    /** Établissements où l'employé courant peut commander (autorités « passer_commande:ID »). */
    private static List<Long> myOrderingEtablissements() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return List.of();
        }
        String prefix = PERMISSION + ":";
        return auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .filter(a -> a.startsWith(prefix))
                .map(a -> {
                    try {
                        return Long.valueOf(a.substring(prefix.length()));
                    } catch (NumberFormatException e) {
                        return null;
                    }
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private static boolean isPatron() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream().anyMatch(a -> "ROLE_PATRON".equals(a.getAuthority()));
    }

    private PurchaseOrder require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Commande introuvable : " + id));
    }

    private static String describe(PurchaseOrder o) {
        return "Commande " + o.getSheetName() + " du " + o.getOrderDate() + " (" + o.getLines().size() + " lignes)";
    }
}
