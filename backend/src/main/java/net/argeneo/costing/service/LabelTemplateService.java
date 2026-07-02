package net.argeneo.costing.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.api.dto.LabelTemplateDtos.Badge;
import net.argeneo.costing.api.dto.LabelTemplateDtos.LabelTemplateRequest;
import net.argeneo.costing.api.dto.LabelTemplateDtos.LabelTemplateResponse;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.entity.LabelTemplate;
import net.argeneo.costing.repository.ArticleRepository;
import net.argeneo.costing.repository.LabelTemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Gestion des modèles d'étiquette (mise en forme + badges), parcours Patron. */
@Service
public class LabelTemplateService {

    private static final List<String> FRAMES = List.of("none", "wood");
    private static final List<String> BADGE_POS = List.of("tr", "tl", "footer");

    // Instance locale : pas de bean ObjectMapper à injecter (le contexte ne démarre pas sinon).
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final LabelTemplateRepository repository;
    private final ArticleRepository articleRepository;

    public LabelTemplateService(LabelTemplateRepository repository, ArticleRepository articleRepository) {
        this.repository = repository;
        this.articleRepository = articleRepository;
    }

    @Transactional(readOnly = true)
    public List<LabelTemplateResponse> list() {
        return repository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public LabelTemplateResponse create(LabelTemplateRequest request) {
        LabelTemplate t = new LabelTemplate();
        apply(t, request);
        return toResponse(repository.save(t));
    }

    @Transactional
    public LabelTemplateResponse update(Long id, LabelTemplateRequest request) {
        LabelTemplate t = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Modèle d'étiquette introuvable : " + id));
        apply(t, request);
        return toResponse(repository.save(t));
    }

    @Transactional
    public void delete(Long id) {
        LabelTemplate t = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Modèle d'étiquette introuvable : " + id));
        // Les articles qui référencent ce modèle sont détachés par la FK (ON DELETE SET NULL).
        repository.delete(t);
    }

    /**
     * Bascule le « modèle par défaut de l'enseigne ». On clique sur le modèle déjà par défaut =>
     * on l'enlève (plus de défaut) ; sinon on le désigne et on retire le défaut des autres
     * (au plus un par tenant, garanti aussi par l'index unique partiel côté BDD).
     */
    @Transactional
    public List<LabelTemplateResponse> toggleDefault(Long id) {
        LabelTemplate target = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Modèle d'étiquette introuvable : " + id));
        boolean makeDefault = !target.isEnseigneDefault();
        // On retire d'abord le défaut partout, PUIS on le flush avant de le poser sur la cible :
        // l'index unique partiel (WHERE is_default) est vérifié à chaque UPDATE, donc la BDD ne
        // doit jamais avoir deux défauts en même temps, même transitoirement.
        for (LabelTemplate t : repository.findAllByOrderByNameAsc()) {
            if (t.isEnseigneDefault()) {
                t.setEnseigneDefault(false);
                repository.save(t);
            }
        }
        repository.flush();
        if (makeDefault) {
            target.setEnseigneDefault(true);
            repository.save(target);
            repository.flush();
        }
        return list();
    }

    /**
     * Affecte en masse des produits à ce modèle (depuis la page Modèles) : équivaut à régler le
     * « modèle par défaut » sur la fiche de chacun des articles fournis.
     */
    @Transactional
    public void assignArticles(Long templateId, List<Long> articleIds) {
        repository.findById(templateId)
                .orElseThrow(() -> new ResourceNotFoundException("Modèle d'étiquette introuvable : " + templateId));
        if (articleIds == null || articleIds.isEmpty()) {
            return;
        }
        List<Article> articles = articleRepository.findAllById(articleIds);
        for (Article a : articles) {
            a.setLabelTemplateId(templateId);
        }
        articleRepository.saveAll(articles);
    }

    private void apply(LabelTemplate t, LabelTemplateRequest r) {
        t.setName(r.name().trim());
        t.setBrand(blankToNull(r.brand()));
        t.setBgColor(orDefault(r.bgColor(), "#ffffff"));
        t.setTextColor(orDefault(r.textColor(), "#111111"));
        t.setBorderColor(orDefault(r.borderColor(), t.getTextColor()));
        t.setWidthCm(clamp(r.widthCm(), 2, 20, 10));
        t.setHeightCm(clamp(r.heightCm(), 2, 28, 6));
        t.setFontScale(clamp(r.fontScale(), 0.5, 2, 1));
        t.setShowPrice(r.showPrice() == null || r.showPrice());
        t.setFrame(oneOf(r.frame(), FRAMES, "none"));
        t.setChalk(Boolean.TRUE.equals(r.chalk()));
        t.setFillSheet(Boolean.TRUE.equals(r.fillSheet()));
        t.setBadgePos(oneOf(r.badgePos(), BADGE_POS, "tr"));
        t.setBadgeScale(clamp(r.badgeScale(), 0.4, 2.5, 1));
        t.setExtraText(blankToNull(r.extraText()));
        t.setUseDescription(Boolean.TRUE.equals(r.useDescription()));
        t.setBadges(writeBadges(r.badges()));
    }

    private LabelTemplateResponse toResponse(LabelTemplate t) {
        return LabelTemplateResponse.from(t, readBadges(t.getBadges()));
    }

    private String writeBadges(List<Badge> badges) {
        if (badges == null || badges.isEmpty()) {
            return null;
        }
        // On ne garde que des badges exploitables (un texte OU une image).
        List<Badge> clean = badges.stream()
                .filter(b -> (b.text() != null && !b.text().isBlank()) || (b.img() != null && !b.img().isBlank()))
                .toList();
        if (clean.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(clean);
        } catch (Exception e) {
            throw new IllegalArgumentException("Badges invalides : " + e.getMessage(), e);
        }
    }

    private List<Badge> readBadges(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return MAPPER.readValue(json, new TypeReference<List<Badge>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String orDefault(String v, String fb) {
        return v == null || v.isBlank() ? fb : v.trim();
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static String oneOf(String v, List<String> allowed, String fb) {
        return v != null && allowed.contains(v) ? v : fb;
    }

    private static double clamp(Double v, double min, double max, double fb) {
        double d = v == null ? fb : v;
        return Math.max(min, Math.min(max, d));
    }
}
