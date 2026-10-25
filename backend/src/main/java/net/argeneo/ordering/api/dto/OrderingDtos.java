package net.argeneo.ordering.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import net.argeneo.ordering.entity.PurchaseOrderStatus;

/** DTOs des commandes fournisseurs : cadenciers, import IA et commandes. */
public final class OrderingDtos {

    private OrderingDtos() {
    }

    // --- Cadenciers ---------------------------------------------------------

    public record SheetLine(
            Long id,
            String section,
            String code,
            String designation,
            String designationAlt,
            String packaging,
            BigDecimal unitPrice,
            String priceUnit,
            Long rawMaterialId) {
    }

    public record SheetSummary(
            Long id,
            String name,
            String supplierName,
            boolean active,
            int lineCount,
            Instant updatedAt) {
    }

    public record SheetResponse(
            Long id,
            String name,
            String supplierName,
            String supplierEmail,
            String supplierPhone,
            String notes,
            String color,
            boolean showPrices,
            boolean active,
            Instant updatedAt,
            List<SheetLine> lines) {
    }

    /** {@code id} : ligne existante à conserver (null = nouvelle ligne). */
    public record SheetLineRequest(
            Long id,
            @Size(max = 120) String section,
            @Size(max = 60) String code,
            @NotBlank @Size(max = 300) String designation,
            @Size(max = 300) String designationAlt,
            @Size(max = 120) String packaging,
            BigDecimal unitPrice,
            @Size(max = 30) String priceUnit,
            Long rawMaterialId) {
    }

    public record SheetRequest(
            @NotBlank @Size(max = 150) String name,
            @Size(max = 255) String supplierName,
            @Size(max = 255) String supplierEmail,
            @Size(max = 50) String supplierPhone,
            String notes,
            @Size(max = 9) String color,
            Boolean showPrices,
            Boolean active,
            @NotNull @Valid List<SheetLineRequest> lines) {
    }

    /** Résultat d'un import (photo/PDF, plusieurs pages) : brouillon à relire, non enregistré. */
    public record SheetScanResult(
            String name,
            String supplierName,
            int pageCount,
            List<SheetLine> lines) {
    }

    // --- Commandes ----------------------------------------------------------

    public record OrderLine(
            Long id,
            Long sheetLineId,
            String section,
            String code,
            String designation,
            String packaging,
            BigDecimal unitPrice,
            String priceUnit,
            BigDecimal quantity) {
    }

    public record OrderSummary(
            Long id,
            Long sheetId,
            String sheetName,
            String supplierName,
            Long etablissementId,
            String etablissementName,
            LocalDate orderDate,
            LocalDate deliveryDate,
            PurchaseOrderStatus status,
            int lineCount,
            BigDecimal totalAmount,
            String createdByName,
            Instant createdAt) {
    }

    public record OrderResponse(
            Long id,
            Long sheetId,
            String sheetName,
            String supplierName,
            Long etablissementId,
            String etablissementName,
            LocalDate orderDate,
            LocalDate deliveryDate,
            PurchaseOrderStatus status,
            String notes,
            String createdByName,
            Instant createdAt,
            Instant validatedAt,
            BigDecimal totalAmount,
            List<OrderLine> lines) {
    }

    /** Quantité saisie : sur un produit du cadencier (sheetLineId) ou sur une ligne libre (designation). */
    public record OrderLineRequest(
            Long sheetLineId,
            @Size(max = 300) String designation,
            @Size(max = 120) String packaging,
            @NotNull BigDecimal quantity) {
    }

    public record OrderRequest(
            @NotNull Long sheetId,
            @NotNull Long etablissementId,
            LocalDate orderDate,
            LocalDate deliveryDate,
            String notes,
            /** true : valide la commande (elle n'est plus modifiable que par le patron). */
            Boolean validate,
            @NotNull @Valid List<OrderLineRequest> lines) {
    }
}
