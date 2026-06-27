package net.argeneo.costing.api.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import net.argeneo.costing.domain.Unit;
import net.argeneo.costing.entity.SupplierInvoiceStatus;

/** DTOs des factures fournisseurs (scan IA → revue → application aux matières premières). */
public final class InvoiceDtos {

    private InvoiceDtos() {
    }

    /** Résumé pour la liste des factures. */
    public record InvoiceSummary(
            Long id,
            String supplierName,
            String invoiceNumber,
            LocalDate invoiceDate,
            BigDecimal totalHt,
            BigDecimal totalTtc,
            SupplierInvoiceStatus status,
            int lineCount,
            int appliedCount,
            boolean hasScan,
            Instant createdAt) {
    }

    /** Détail d'une facture avec ses lignes et les suggestions d'association MP. */
    public record InvoiceResponse(
            Long id,
            Long etablissementId,
            String supplierName,
            String invoiceNumber,
            LocalDate invoiceDate,
            BigDecimal totalHt,
            BigDecimal totalVat,
            BigDecimal totalTtc,
            boolean hasScan,
            SupplierInvoiceStatus status,
            Instant createdAt,
            Instant appliedAt,
            List<InvoiceLineResponse> lines) {
    }

    /**
     * Ligne extraite + suggestion de rattachement à une matière première.
     * {@code suggestedPricePerUnit} est calculé (prix par unité de référence) quand l'unité de la
     * facture est reconnue et compatible avec la MP suggérée ; sinon null (à saisir par le patron).
     */
    public record InvoiceLineResponse(
            Long id,
            int position,
            String designation,
            BigDecimal quantity,
            String unit,
            BigDecimal unitPriceHt,
            BigDecimal lineTotalHt,
            BigDecimal vatRate,
            boolean applied,
            Long rawMaterialId,
            BigDecimal appliedPricePerUnit,
            // Suggestions calculées au moment de la lecture (non persistées).
            Long suggestedRawMaterialId,
            String suggestedRawMaterialName,
            Unit suggestedReferenceUnit,
            BigDecimal suggestedPricePerUnit,
            // Classement proposé par l'IA et créé au scan.
            Long suggestedFamilleId,
            String suggestedFamilleName,
            Long suggestedSousFamilleId,
            String suggestedSousFamilleName) {
    }

    public enum ApplyAction {
        /** Mettre à jour le prix d'une MP existante (rawMaterialId + pricePerUnit). */
        UPDATE,
        /** Créer une nouvelle MP (newName + newReferenceUnit + pricePerUnit [+ famille]). */
        CREATE,
        /** Ignorer cette ligne. */
        SKIP
    }

    public record ApplyLine(
            @NotNull Long lineId,
            @NotNull ApplyAction action,
            Long rawMaterialId,
            BigDecimal pricePerUnit,
            String newName,
            Unit newReferenceUnit,
            Long familleId,
            Long sousFamilleId) {
    }

    public record ApplyRequest(
            @NotNull List<ApplyLine> lines) {
    }
}
