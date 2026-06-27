package net.argeneo.costing.service;

import java.util.List;
import java.util.Map;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.api.dto.MaterialDtos.CreateRawMaterialRequest;
import net.argeneo.costing.api.dto.MaterialDtos.RawMaterialResponse;
import net.argeneo.costing.api.dto.MaterialDtos.UpdateRawMaterialRequest;
import net.argeneo.costing.entity.FamilleScope;
import net.argeneo.costing.entity.RawMaterial;
import net.argeneo.costing.repository.RawMaterialRepository;
import net.argeneo.costing.repository.RecipeComponentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Gestion des matières premières (parcours Patron). */
@Service
public class MaterialService {

    private final RawMaterialRepository repository;
    private final RecipeComponentRepository componentRepository;
    private final FamilleService familleService;

    public MaterialService(RawMaterialRepository repository,
                           RecipeComponentRepository componentRepository,
                           FamilleService familleService) {
        this.repository = repository;
        this.componentRepository = componentRepository;
        this.familleService = familleService;
    }

    @Transactional
    public void delete(Long id) {
        RawMaterial material = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Matière première introuvable : " + id));
        if (componentRepository.existsByRawMaterialId(material.getId())) {
            throw new ConflictException(
                    "Cette matière est utilisée dans une recette ; retirez-la d'abord.");
        }
        repository.delete(material);
    }

    @Transactional
    public RawMaterialResponse create(CreateRawMaterialRequest request) {
        familleService.validateAssignment(FamilleScope.RAW_MATERIAL, request.familleId(), request.sousFamilleId());
        RawMaterial material = new RawMaterial();
        material.setName(request.name());
        material.setReferenceUnit(request.referenceUnit());
        material.setPricePerUnit(request.pricePerUnit());
        material.setSupplier(request.supplier());
        material.setFamilleId(request.familleId());
        material.setSousFamilleId(request.sousFamilleId());
        return toResponse(repository.save(material));
    }

    @Transactional(readOnly = true)
    public List<RawMaterialResponse> list() {
        Map<Long, String> names = familleService.namesByScope(FamilleScope.RAW_MATERIAL);
        return repository.findAllByOrderByNameAsc().stream()
                .map(m -> RawMaterialResponse.from(m,
                        names.get(m.getFamilleId()), names.get(m.getSousFamilleId())))
                .toList();
    }

    @Transactional
    public RawMaterialResponse update(Long id, UpdateRawMaterialRequest request) {
        RawMaterial material = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Matière première introuvable : " + id));
        familleService.validateAssignment(FamilleScope.RAW_MATERIAL, request.familleId(), request.sousFamilleId());
        material.setName(request.name());
        material.setPricePerUnit(request.pricePerUnit());
        if (request.referenceUnit() != null) {
            material.setReferenceUnit(request.referenceUnit());
        }
        material.setSupplier(request.supplier());
        material.setFamilleId(request.familleId());
        material.setSousFamilleId(request.sousFamilleId());
        if (request.active() != null) {
            material.setActive(request.active());
        }
        return toResponse(repository.save(material));
    }

    private RawMaterialResponse toResponse(RawMaterial m) {
        Map<Long, String> names = familleService.namesByScope(FamilleScope.RAW_MATERIAL);
        return RawMaterialResponse.from(m, names.get(m.getFamilleId()), names.get(m.getSousFamilleId()));
    }
}
