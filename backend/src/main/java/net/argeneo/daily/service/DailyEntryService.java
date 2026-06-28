package net.argeneo.daily.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.repository.ArticleRepository;
import net.argeneo.daily.api.dto.DailyDtos.DailyEntryResponse;
import net.argeneo.daily.api.dto.DailyDtos.LossLineRequest;
import net.argeneo.daily.api.dto.DailyDtos.LossLineResponse;
import net.argeneo.daily.api.dto.DailyDtos.ScanTicketResponse;
import net.argeneo.daily.api.dto.DailyDtos.UpsertDailyRequest;
import net.argeneo.daily.domain.DailyEntry;
import net.argeneo.daily.domain.DailyEntryLoss;
import net.argeneo.daily.repository.DailyEntryRepository;
import net.argeneo.iam.repository.EtablissementRepository;
import net.argeneo.insights.GeminiClient;
import net.argeneo.security.EtablissementAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Saisie quotidienne par etablissement et par jour : CA global, casse par
 * article et mots du jour (production / vente), enregistrés en une fois.
 */
@Service
public class DailyEntryService {

    // Instance locale : pas de bean ObjectMapper à injecter, parsing en arbre robuste.
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final DailyEntryRepository repository;
    private final EtablissementRepository etablissementRepository;
    private final ArticleRepository articleRepository;
    private final EtablissementAccess access;
    private final GeminiClient gemini;

    public DailyEntryService(DailyEntryRepository repository,
                             EtablissementRepository etablissementRepository,
                             ArticleRepository articleRepository,
                             EtablissementAccess access,
                             GeminiClient gemini) {
        this.repository = repository;
        this.etablissementRepository = etablissementRepository;
        this.articleRepository = articleRepository;
        this.access = access;
        this.gemini = gemini;
    }

    /** Extrait CA / nb clients / date d'une photo de ticket Z de caisse (sans persister). */
    @Transactional(readOnly = true)
    public ScanTicketResponse scanTicket(Long etablissementId, byte[] image, String mime) {
        requireEtablissement(etablissementId);
        if (!gemini.isConfigured()) {
            throw new ConflictException("Analyse IA non configurée sur ce serveur.");
        }
        if (image == null || image.length == 0) {
            throw new ConflictException("Image vide.");
        }
        String prompt = """
                Tu lis un TICKET Z (clôture de journée) d'une caisse enregistreuse de boulangerie.
                Renvoie UNIQUEMENT un JSON : {"date":"AAAA-MM-JJ"|null,"revenue":number|null,"clientCount":number|null}.
                - "revenue" = chiffre d'affaires TOTAL de la journée en euros (TTC, le « Total CA » / « Total TTC »),
                  point décimal, sans symbole.
                - "clientCount" = nombre de tickets / clients / opérations de vente de la journée (entier).
                - "date" = la date de la journée si visible.
                Si une valeur est illisible, mets null. N'invente rien.
                """;
        JsonNode root = readJson(gemini.extractStructured(image, mime, prompt));
        if (root == null) {
            return new ScanTicketResponse(null, null, null);
        }
        return new ScanTicketResponse(parseDate(text(root, "date")),
                num(root, "revenue"), intOrNull(root, "clientCount"));
    }

    @Transactional(readOnly = true)
    public DailyEntryResponse getDay(Long etablissementId, LocalDate date) {
        requireEtablissement(etablissementId);
        Map<Long, Article> articles = articlesById();
        return repository.findByEtablissementIdAndEntryDate(etablissementId, date)
                .map(e -> toResponse(e, articles))
                .orElseGet(() -> DailyEntryResponse.empty(etablissementId, date));
    }

    @Transactional(readOnly = true)
    public List<DailyEntryResponse> listRange(Long etablissementId, LocalDate from, LocalDate to) {
        requireEtablissement(etablissementId);
        Map<Long, Article> articles = articlesById();
        return repository
                .findByEtablissementIdAndEntryDateBetweenOrderByEntryDateDesc(etablissementId, from, to)
                .stream().map(e -> toResponse(e, articles)).toList();
    }

    /**
     * Enregistre toute la journée d'un coup. Chaque partie n'est appliquée que
     * si l'utilisateur courant en a la permission (le formulaire désactive le
     * reste) — on ne touche pas aux champs non autorisés.
     */
    @Transactional
    public DailyEntryResponse upsert(Long etablissementId, LocalDate date, UpsertDailyRequest request) {
        DailyEntry entry = getOrCreate(etablissementId, date);

        if (access.canRevenue(etablissementId)) {
            entry.setRevenue(request.revenue());
            entry.setClientCount(request.clientCount());
        }
        if (access.canNote(etablissementId)) {
            entry.setNoteProd(blankToNull(request.noteProd()));
            entry.setNoteSale(blankToNull(request.noteSale()));
        }
        if (access.canLoss(etablissementId)) {
            entry.replaceLosses(toLossEntities(request.losses()));
            entry.setLossAmount(request.lossAmount());
        }

        DailyEntry saved = repository.save(entry);
        return toResponse(saved, articlesById());
    }

    private List<DailyEntryLoss> toLossEntities(List<LossLineRequest> lines) {
        if (lines == null) {
            return List.of();
        }
        return lines.stream()
                .map(l -> new DailyEntryLoss(l.articleId(), l.quantity()))
                .toList();
    }

    private DailyEntryResponse toResponse(DailyEntry e, Map<Long, Article> articles) {
        List<LossLineResponse> losses = e.getLosses().stream()
                .map(l -> {
                    Article a = articles.get(l.getArticleId());
                    return new LossLineResponse(
                            l.getArticleId(),
                            a == null ? null : a.getCode(),
                            a == null ? "Article #" + l.getArticleId() : a.getName(),
                            l.getQuantity());
                })
                .toList();
        return new DailyEntryResponse(e.getEtablissementId(), e.getEntryDate(), e.getRevenue(),
                e.getClientCount(), losses, e.getLossAmount(), e.getNoteProd(), e.getNoteSale(),
                e.getUpdatedAt());
    }

    private Map<Long, Article> articlesById() {
        return articleRepository.findAll().stream()
                .collect(Collectors.toMap(Article::getId, Function.identity(), (a, b) -> a));
    }

    private DailyEntry getOrCreate(Long etablissementId, LocalDate date) {
        requireEtablissement(etablissementId);
        return repository.findByEtablissementIdAndEntryDate(etablissementId, date)
                .orElseGet(() -> new DailyEntry(etablissementId, date));
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    /** Garantit que la etablissement appartient au tenant courant (sinon 404). */
    private void requireEtablissement(Long etablissementId) {
        etablissementRepository.findById(etablissementId)
                .orElseThrow(() -> new ResourceNotFoundException("Etablissement introuvable : " + etablissementId));
    }

    // --- Parsing du JSON d'extraction (ticket Z) ---

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
        return s.isEmpty() || "null".equalsIgnoreCase(s) ? null : s;
    }

    private static BigDecimal num(JsonNode node, String field) {
        JsonNode v = node.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        if (v.isNumber()) {
            return v.decimalValue();
        }
        String s = v.asText().trim().replace(" ", "").replace(" ", "").replace("€", "").replace(",", ".");
        if (s.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer intOrNull(JsonNode node, String field) {
        BigDecimal n = num(node, field);
        return n == null ? null : n.intValue();
    }

    private static String parseDate(String s) {
        if (s == null) {
            return null;
        }
        for (DateTimeFormatter f : List.of(DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("dd/MM/yyyy"),
                DateTimeFormatter.ofPattern("dd-MM-yyyy"),
                DateTimeFormatter.ofPattern("dd.MM.yyyy"))) {
            try {
                return LocalDate.parse(s, f).toString();
            } catch (Exception ignored) {
                // format suivant
            }
        }
        return null;
    }
}
