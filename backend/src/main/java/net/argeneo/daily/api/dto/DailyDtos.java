package net.argeneo.daily.api.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import net.argeneo.daily.domain.DailyEntry;

/** DTOs de la saisie quotidienne. */
public final class DailyDtos {

    private DailyDtos() {
    }

    public record SetRevenueRequest(@NotNull @PositiveOrZero BigDecimal revenue) {
    }

    public record SetLossRequest(@NotNull @PositiveOrZero BigDecimal loss) {
    }

    public record SetNoteRequest(String note) {
    }

    public record DailyEntryResponse(
            Long etablissementId,
            LocalDate date,
            BigDecimal revenue,
            BigDecimal loss,
            String noteOfDay,
            Instant updatedAt) {

        public static DailyEntryResponse from(DailyEntry e) {
            return new DailyEntryResponse(e.getEtablissementId(), e.getEntryDate(),
                    e.getRevenue(), e.getLoss(), e.getNoteOfDay(), e.getUpdatedAt());
        }

        /** Réponse "vide" pour un jour sans saisie. */
        public static DailyEntryResponse empty(Long etablissementId, LocalDate date) {
            return new DailyEntryResponse(etablissementId, date, null, null, null, null);
        }
    }
}
