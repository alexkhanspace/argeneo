package net.argeneo.insights.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/** DTOs de l'avis de tendance (Gemini). Le contexte est fourni par le front. */
public final class InsightDtos {

    private InsightDtos() {
    }

    /** Contexte d'un jour, tel que le front le connaît déjà. */
    public record DayContext(
            String date,
            String weekday,
            Double revenue,
            Integer clientCount,
            Double tMax,
            Double tMaxN1,
            String events,
            Double caN1Date,
            Double caN1Equiv,
            String noteProd,
            String noteSale,
            String noteProdN1,
            String noteSaleN1,
            String eventsAr,
            String eventsAa,
            String sky,
            String skyN1,
            String hourly) {
    }

    public record TrendRequest(
            @NotBlank String etablissement,
            String description,
            String location,
            String periode,
            String baseline,
            @NotEmpty List<DayContext> days) {
    }

    /** Un conseil IA pour un jour donné. */
    public record DayAdvice(String date, String conseil) {
    }

    public record TrendResponse(boolean enabled, String model, List<DayAdvice> days) {
    }

    /**
     * Analyse d'UNE journée précise (répond toujours, pour le tableau de bord).
     * mode = "action" (que produire aujourd'hui) ou "bilan" (analyse a posteriori).
     */
    public record DayAnalysisRequest(
            @NotBlank String etablissement,
            String description,
            String location,
            String mode,
            String baseline,
            Boolean detail,
            @jakarta.validation.constraints.NotNull DayContext day) {
    }

    public record DayAnalysisResponse(boolean enabled, String model, String analysis) {
    }

    /** Avis IA sur le prix de vente d'un article (cohérence marché + marge + prix psychologique). */
    public record PricingRequest(
            @NotBlank String etablissement,
            String description,
            String location,
            @NotBlank String articleName,
            String articleType,
            String articleDescription,
            Double pnetHt,
            Double vatRate,
            Double priceTtc) {
    }

    public record PricingResponse(boolean enabled, String model, String advice) {
    }

    /** Accroches publicitaires pour une nouveauté (visuel composé côté front). */
    public record AdCopyRequest(
            @NotBlank String etablissement,
            String description,
            String location,
            @NotBlank String articleName,
            String articleDescription,
            Double priceTtc) {
    }

    public record AdCopyResponse(boolean enabled, String model, List<String> slogans) {
    }

    /** Publication réseaux sociaux libre (événement, promo, actualité) — visuel composé côté front. */
    public record SocialPostRequest(
            @NotBlank String etablissement,
            String description,
            String location,
            /** Sujet / brief libre (ex. « 170 paniers offerts au don du sang de Mulhouse »). */
            @NotBlank String brief,
            /** Réseau visé (Instagram, Facebook…), optionnel. */
            String platform,
            /** Ton souhaité (chaleureux, fier, festif…), optionnel. */
            String tone) {
    }

    public record SocialPostResponse(boolean enabled, String model, String caption) {
    }
}
