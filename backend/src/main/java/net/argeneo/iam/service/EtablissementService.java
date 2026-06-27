package net.argeneo.iam.service;

import java.util.List;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.iam.api.dto.EtablissementDtos.CreateEtablissementRequest;
import net.argeneo.iam.api.dto.EtablissementDtos.EtablissementResponse;
import net.argeneo.iam.api.dto.EtablissementDtos.UpdateEtablissementRequest;
import net.argeneo.iam.domain.Etablissement;
import net.argeneo.iam.repository.EtablissementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Gestion des etablissements du tenant courant (parcours Patron). */
@Service
public class EtablissementService {

    private final EtablissementRepository etablissementRepository;

    public EtablissementService(EtablissementRepository etablissementRepository) {
        this.etablissementRepository = etablissementRepository;
    }

    @Transactional
    public EtablissementResponse create(CreateEtablissementRequest request) {
        Etablissement etablissement = new Etablissement();
        etablissement.setName(request.name());
        etablissement.setAddress(request.address());
        etablissement.setLatitude(request.latitude());
        etablissement.setLongitude(request.longitude());
        etablissement.setDescription(request.description());
        return EtablissementResponse.from(etablissementRepository.save(etablissement));
    }

    @Transactional
    public EtablissementResponse update(Long id, UpdateEtablissementRequest request) {
        Etablissement etablissement = etablissementRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Etablissement introuvable : " + id));
        etablissement.setName(request.name());
        etablissement.setAddress(request.address());
        etablissement.setLatitude(request.latitude());
        etablissement.setLongitude(request.longitude());
        etablissement.setDescription(request.description());
        return EtablissementResponse.from(etablissementRepository.save(etablissement));
    }

    @Transactional(readOnly = true)
    public List<EtablissementResponse> list() {
        return etablissementRepository.findAllByOrderByNameAsc()
                .stream().map(EtablissementResponse::from).toList();
    }
}
