package net.argeneo.costing.service;

import java.util.List;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.api.dto.MaterialDtos.CreateRawMaterialRequest;
import net.argeneo.costing.api.dto.MaterialDtos.RawMaterialResponse;
import net.argeneo.costing.api.dto.MaterialDtos.UpdateRawMaterialRequest;
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

    public MaterialService(RawMaterialRepository repository,
                           RecipeComponentRepository componentRepository) {
        this.repository = repository;
        this.componentRepository = componentRepository;
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
        RawMaterial material = new RawMaterial();
        material.setName(request.name());
        material.setReferenceUnit(request.referenceUnit());
        material.setPricePerUnit(request.pricePerUnit());
        return RawMaterialResponse.from(repository.save(material));
    }

    @Transactional(readOnly = true)
    public List<RawMaterialResponse> list() {
        return repository.findAllByOrderByNameAsc().stream().map(RawMaterialResponse::from).toList();
    }

    @Transactional
    public RawMaterialResponse update(Long id, UpdateRawMaterialRequest request) {
        RawMaterial material = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Matière première introuvable : " + id));
        material.setName(request.name());
        material.setPricePerUnit(request.pricePerUnit());
        if (request.active() != null) {
            material.setActive(request.active());
        }
        return RawMaterialResponse.from(repository.save(material));
    }
}
