package net.argeneo.billing.service;

import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.iam.domain.Etablissement;
import net.argeneo.iam.repository.EtablissementRepository;
import org.springframework.stereotype.Component;

/**
 * Résout l'établissement courant du patron pour les fonctionnalités de
 * facturation. S'il existe plusieurs établissements, le premier (ordre
 * alphabétique) est retenu ; un id peut être passé explicitement.
 */
@Component
public class BillingContext {

    private final EtablissementRepository etablissementRepository;

    public BillingContext(EtablissementRepository etablissementRepository) {
        this.etablissementRepository = etablissementRepository;
    }

    /** Établissement courant (le premier du tenant), ou celui demandé via {@code etablissementId}. */
    public Etablissement currentEtablissement(Long etablissementId) {
        if (etablissementId != null) {
            return etablissementRepository.findById(etablissementId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Établissement introuvable : " + etablissementId));
        }
        return etablissementRepository.findAllByOrderByNameAsc().stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Aucun établissement : créez d'abord un établissement."));
    }

    public Long currentEtablissementId(Long etablissementId) {
        return currentEtablissement(etablissementId).getId();
    }
}
