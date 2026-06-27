package net.argeneo.billing.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import net.argeneo.billing.domain.BillingDocument;
import net.argeneo.billing.domain.BillingDocumentLine;
import net.argeneo.billing.domain.DocumentStatus;
import net.argeneo.billing.domain.DocumentType;

/** DTOs des documents de facturation (devis / factures) et de leurs lignes. */
public final class DocumentDtos {

    private DocumentDtos() {
    }

    /** Une ligne en requête (les totaux sont recalculés côté serveur). */
    public record LineRequest(
            @NotBlank String designation,
            Long articleId,
            @NotNull BigDecimal quantity,
            String unit,
            @NotNull BigDecimal unitPriceHt,
            BigDecimal vatRate,
            BigDecimal discountRate) {
    }

    /** Création : le type est figé à la création (DEVIS ou FACTURE). */
    public record CreateDocumentRequest(
            @NotNull DocumentType type,
            @NotNull Long clientId,
            LocalDate issueDate,
            LocalDate dueDate,
            String notes,
            String terms,
            @Valid List<LineRequest> lines) {
    }

    /** Mise à jour d'un brouillon (client, dates, mentions, lignes). */
    public record UpdateDocumentRequest(
            @NotNull Long clientId,
            LocalDate issueDate,
            LocalDate dueDate,
            String notes,
            String terms,
            @Valid List<LineRequest> lines) {
    }

    public record ChangeStatusRequest(
            @NotNull DocumentStatus status) {
    }

    public record LineResponse(
            Long id,
            Integer position,
            String designation,
            Long articleId,
            BigDecimal quantity,
            String unit,
            BigDecimal unitPriceHt,
            BigDecimal vatRate,
            BigDecimal discountRate,
            BigDecimal lineTotalHt) {

        public static LineResponse from(BillingDocumentLine l) {
            return new LineResponse(l.getId(), l.getPosition(), l.getDesignation(),
                    l.getArticleId(), l.getQuantity(), l.getUnit(), l.getUnitPriceHt(),
                    l.getVatRate(), l.getDiscountRate(), l.getLineTotalHt());
        }
    }

    public record DocumentResponse(
            Long id,
            DocumentType type,
            String number,
            DocumentStatus status,
            Long clientId,
            String clientName,
            LocalDate issueDate,
            LocalDate dueDate,
            String currency,
            BigDecimal totalHt,
            BigDecimal totalVat,
            BigDecimal totalTtc,
            String notes,
            String terms,
            List<LineResponse> lines) {

        public static DocumentResponse from(BillingDocument d, String clientName) {
            List<LineResponse> lines = d.getLines().stream()
                    .sorted((a, b) -> Integer.compare(
                            a.getPosition() == null ? 0 : a.getPosition(),
                            b.getPosition() == null ? 0 : b.getPosition()))
                    .map(LineResponse::from)
                    .toList();
            return new DocumentResponse(d.getId(), d.getType(), d.getNumber(), d.getStatus(),
                    d.getClientId(), clientName, d.getIssueDate(), d.getDueDate(), d.getCurrency(),
                    d.getTotalHt(), d.getTotalVat(), d.getTotalTtc(), d.getNotes(), d.getTerms(),
                    lines);
        }
    }
}
