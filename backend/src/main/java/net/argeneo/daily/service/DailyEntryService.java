package net.argeneo.daily.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.repository.ArticleRepository;
import net.argeneo.daily.api.dto.DailyDtos.DailyEntryResponse;
import net.argeneo.daily.api.dto.DailyDtos.LossLineRequest;
import net.argeneo.daily.api.dto.DailyDtos.LossLineResponse;
import net.argeneo.daily.api.dto.DailyDtos.UpsertDailyRequest;
import net.argeneo.daily.domain.DailyEntry;
import net.argeneo.daily.domain.DailyEntryLoss;
import net.argeneo.daily.repository.DailyEntryRepository;
import net.argeneo.iam.repository.EtablissementRepository;
import net.argeneo.security.EtablissementAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Saisie quotidienne par etablissement et par jour : CA global, casse par
 * article et mots du jour (production / vente), enregistrés en une fois.
 */
@Service
public class DailyEntryService {

    private final DailyEntryRepository repository;
    private final EtablissementRepository etablissementRepository;
    private final ArticleRepository articleRepository;
    private final EtablissementAccess access;

    public DailyEntryService(DailyEntryRepository repository,
                             EtablissementRepository etablissementRepository,
                             ArticleRepository articleRepository,
                             EtablissementAccess access) {
        this.repository = repository;
        this.etablissementRepository = etablissementRepository;
        this.articleRepository = articleRepository;
        this.access = access;
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
                e.getClientCount(), losses, e.getNoteProd(), e.getNoteSale(), e.getUpdatedAt());
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
}
