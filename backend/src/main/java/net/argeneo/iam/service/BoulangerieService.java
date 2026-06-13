package net.argeneo.iam.service;

import java.util.List;
import net.argeneo.iam.api.dto.BoulangerieDtos.BoulangerieResponse;
import net.argeneo.iam.api.dto.BoulangerieDtos.CreateBoulangerieRequest;
import net.argeneo.iam.domain.Boulangerie;
import net.argeneo.iam.repository.BoulangerieRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Gestion des boulangeries du tenant courant (parcours Patron). */
@Service
public class BoulangerieService {

    private final BoulangerieRepository boulangerieRepository;

    public BoulangerieService(BoulangerieRepository boulangerieRepository) {
        this.boulangerieRepository = boulangerieRepository;
    }

    @Transactional
    public BoulangerieResponse create(CreateBoulangerieRequest request) {
        Boulangerie boulangerie = new Boulangerie();
        boulangerie.setName(request.name());
        boulangerie.setAddress(request.address());
        return BoulangerieResponse.from(boulangerieRepository.save(boulangerie));
    }

    @Transactional(readOnly = true)
    public List<BoulangerieResponse> list() {
        return boulangerieRepository.findAllByOrderByNameAsc()
                .stream().map(BoulangerieResponse::from).toList();
    }
}
