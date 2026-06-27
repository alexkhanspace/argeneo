package net.argeneo.costing.service;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.api.dto.FamilleDtos.CreateFamilleRequest;
import net.argeneo.costing.api.dto.FamilleDtos.FamilleResponse;
import net.argeneo.costing.api.dto.FamilleDtos.UpdateFamilleRequest;
import net.argeneo.costing.entity.Famille;
import net.argeneo.costing.entity.FamilleScope;
import net.argeneo.costing.repository.ArticleRepository;
import net.argeneo.costing.repository.FamilleRepository;
import net.argeneo.costing.repository.RawMaterialRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Référentiel des familles / sous-familles. Deux arborescences séparées (produits / matières)
 * via {@link FamilleScope}, chacune à deux niveaux (famille → sous-famille).
 */
@Service
public class FamilleService {

    private final FamilleRepository repository;
    private final ArticleRepository articleRepository;
    private final RawMaterialRepository rawMaterialRepository;

    public FamilleService(FamilleRepository repository,
                          ArticleRepository articleRepository,
                          RawMaterialRepository rawMaterialRepository) {
        this.repository = repository;
        this.articleRepository = articleRepository;
        this.rawMaterialRepository = rawMaterialRepository;
    }

    /** Arborescence (familles + sous-familles imbriquées) d'un périmètre. */
    @Transactional(readOnly = true)
    public List<FamilleResponse> tree(FamilleScope scope) {
        List<Famille> all = repository.findByScopeOrderByPositionAscNameAsc(scope);
        Map<Long, List<Famille>> childrenByParent = all.stream()
                .filter(f -> f.getParentId() != null)
                .collect(Collectors.groupingBy(Famille::getParentId));
        return all.stream()
                .filter(f -> f.getParentId() == null)
                .map(f -> FamilleResponse.withChildren(f, childrenByParent
                        .getOrDefault(f.getId(), List.of()).stream()
                        .sorted(byPositionThenName())
                        .map(FamilleResponse::leaf)
                        .toList()))
                .toList();
    }

    @Transactional
    public FamilleResponse create(FamilleScope scope, CreateFamilleRequest request) {
        Famille parent = null;
        if (request.parentId() != null) {
            parent = requireInScope(request.parentId(), scope);
            if (parent.getParentId() != null) {
                throw new IllegalArgumentException(
                        "Une sous-famille ne peut pas être rattachée à une autre sous-famille.");
            }
        }
        Famille famille = new Famille();
        famille.setScope(scope);
        famille.setParentId(parent == null ? null : parent.getId());
        famille.setName(request.name().trim());
        famille.setPosition(repository.findByScopeOrderByPositionAscNameAsc(scope).size());
        return FamilleResponse.leaf(repository.save(famille));
    }

    @Transactional
    public FamilleResponse update(Long id, FamilleScope scope, UpdateFamilleRequest request) {
        Famille famille = requireInScope(id, scope);
        famille.setName(request.name().trim());
        return FamilleResponse.leaf(repository.save(famille));
    }

    @Transactional
    public void delete(Long id, FamilleScope scope) {
        Famille famille = requireInScope(id, scope);
        boolean isTopLevel = famille.getParentId() == null;
        if (isTopLevel && repository.existsByParentId(id)) {
            throw new ConflictException(
                    "Cette famille contient des sous-familles ; supprimez-les d'abord.");
        }
        if (isUsed(scope, id, isTopLevel)) {
            throw new ConflictException(
                    "Cette " + (isTopLevel ? "famille" : "sous-famille")
                    + " est attribuée à des éléments ; détachez-les d'abord.");
        }
        repository.delete(famille);
    }

    /**
     * Valide un couple (famille, sous-famille) pour un article/une matière du périmètre donné,
     * et lève une exception si les références sont incohérentes. À appeler avant l'enregistrement.
     */
    @Transactional(readOnly = true)
    public void validateAssignment(FamilleScope scope, Long familleId, Long sousFamilleId) {
        if (sousFamilleId != null && familleId == null) {
            throw new IllegalArgumentException("Précisez la famille avant la sous-famille.");
        }
        if (familleId != null) {
            Famille famille = requireInScope(familleId, scope);
            if (famille.getParentId() != null) {
                throw new IllegalArgumentException("L'identifiant de famille désigne une sous-famille.");
            }
        }
        if (sousFamilleId != null) {
            Famille sous = requireInScope(sousFamilleId, scope);
            if (sous.getParentId() == null) {
                throw new IllegalArgumentException("L'identifiant de sous-famille désigne une famille.");
            }
            if (!sous.getParentId().equals(familleId)) {
                throw new IllegalArgumentException("La sous-famille n'appartient pas à la famille choisie.");
            }
        }
    }

    /** Noms par id pour enrichir les réponses (toutes familles d'un périmètre). */
    @Transactional(readOnly = true)
    public Map<Long, String> namesByScope(FamilleScope scope) {
        return repository.findByScopeOrderByPositionAscNameAsc(scope).stream()
                .collect(Collectors.toMap(Famille::getId, Famille::getName));
    }

    /**
     * Renvoie l'id d'une famille (ou sous-famille si {@code parentId} non nul) du nom donné,
     * en la créant si elle n'existe pas. La comparaison ignore casse et accents pour éviter les
     * doublons. Utilisé par le classement automatique des matières au scan de facture.
     */
    @Transactional
    public Long findOrCreateByName(FamilleScope scope, String name, Long parentId) {
        if (name == null || name.isBlank()) {
            return null;
        }
        String norm = normalize(name);
        List<Famille> all = repository.findByScopeOrderByPositionAscNameAsc(scope);
        for (Famille f : all) {
            boolean sameParent = parentId == null ? f.getParentId() == null : parentId.equals(f.getParentId());
            if (sameParent && normalize(f.getName()).equals(norm)) {
                return f.getId();
            }
        }
        Famille f = new Famille();
        f.setScope(scope);
        f.setParentId(parentId);
        f.setName(name.trim());
        f.setPosition(all.size());
        return repository.save(f).getId();
    }

    private static String normalize(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }

    private boolean isUsed(FamilleScope scope, Long id, boolean isTopLevel) {
        return switch (scope) {
            case ARTICLE -> isTopLevel
                    ? articleRepository.existsByFamilleId(id)
                    : articleRepository.existsBySousFamilleId(id);
            case RAW_MATERIAL -> isTopLevel
                    ? rawMaterialRepository.existsByFamilleId(id)
                    : rawMaterialRepository.existsBySousFamilleId(id);
        };
    }

    private Famille requireInScope(Long id, FamilleScope scope) {
        return repository.findByIdAndScope(id, scope)
                .orElseThrow(() -> new ResourceNotFoundException("Famille introuvable : " + id));
    }

    private static Comparator<Famille> byPositionThenName() {
        return Comparator.comparing(Famille::getPosition, Comparator.nullsLast(Integer::compareTo))
                .thenComparing(Famille::getName, Comparator.nullsLast(String::compareTo));
    }
}
