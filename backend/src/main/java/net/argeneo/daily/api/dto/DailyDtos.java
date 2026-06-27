package net.argeneo.daily.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** DTOs de la saisie quotidienne (CA global, casse par article, mots du jour). */
public final class DailyDtos {

    private DailyDtos() {
    }

    /** Données extraites d'une photo de ticket Z (pré-remplissage, non persisté). */
    public record ScanTicketResponse(String date, BigDecimal revenue, Integer clientCount) {
    }

    /** Une ligne de casse en entrée : article + quantité perdue. */
    public record LossLineRequest(
            @NotNull Long articleId,
            @NotNull @Positive BigDecimal quantity) {
    }

    /** Enregistrement global d'une journée (un seul bouton « Enregistrer »). */
    public record UpsertDailyRequest(
            @PositiveOrZero BigDecimal revenue,
            @PositiveOrZero Integer clientCount,
            @Valid List<LossLineRequest> losses,
            String noteProd,
            String noteSale) {
    }

    /** Une ligne de casse en sortie, enrichie du libellé de l'article. */
    public record LossLineResponse(
            Long articleId,
            String articleCode,
            String articleName,
            BigDecimal quantity) {
    }

    public record DailyEntryResponse(
            Long etablissementId,
            LocalDate date,
            BigDecimal revenue,
            Integer clientCount,
            List<LossLineResponse> losses,
            String noteProd,
            String noteSale,
            Instant updatedAt) {

        /** Réponse "vide" pour un jour sans saisie. */
        public static DailyEntryResponse empty(Long etablissementId, LocalDate date) {
            return new DailyEntryResponse(etablissementId, date, null, null, List.of(), null, null, null);
        }
    }
}
