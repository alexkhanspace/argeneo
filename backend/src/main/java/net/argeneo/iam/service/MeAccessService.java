package net.argeneo.iam.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import net.argeneo.iam.domain.Etablissement;
import net.argeneo.iam.domain.Permission;
import net.argeneo.iam.domain.UserRole;
import net.argeneo.iam.repository.EtablissementRepository;
import net.argeneo.iam.repository.PermissionGrantRepository;
import net.argeneo.iam.repository.PermissionRepository;
import net.argeneo.security.AuthPrincipal;
import net.argeneo.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Vue "mes accès" : les etablissements que l'utilisateur courant peut piloter, et avec quels droits. */
@Service
public class MeAccessService {

    /** Une etablissement accessible + les permissions de l'utilisateur courant dessus. */
    public record AccessibleEtablissement(Long id, String name, Double latitude, Double longitude,
                                          String description, String address, List<String> permissions) {
    }

    private final EtablissementRepository etablissementRepository;
    private final PermissionGrantRepository grantRepository;
    private final PermissionRepository permissionRepository;

    public MeAccessService(EtablissementRepository etablissementRepository,
                           PermissionGrantRepository grantRepository,
                           PermissionRepository permissionRepository) {
        this.etablissementRepository = etablissementRepository;
        this.grantRepository = grantRepository;
        this.permissionRepository = permissionRepository;
    }

    @Transactional(readOnly = true)
    public List<AccessibleEtablissement> myEtablissements() {
        AuthPrincipal me = CurrentUser.require();

        if (me.isSuperAdmin()) {
            return List.of();
        }

        if (me.role() == UserRole.PATRON) {
            // Le patron a toutes les permissions sur toutes ses etablissements.
            List<String> allCodes = permissionRepository.findAllByOrderByCategoryAscCodeAsc()
                    .stream().map(Permission::getCode).sorted().toList();
            return etablissementRepository.findAllByOrderByNameAsc().stream()
                    .map(b -> new AccessibleEtablissement(b.getId(), b.getName(),
                            b.getLatitude(), b.getLongitude(), b.getDescription(), b.getAddress(), allCodes))
                    .toList();
        }

        // Employé : etablissements déduites de ses attributions.
        Map<Long, List<String>> byEtablissement = new LinkedHashMap<>();
        grantRepository.findByUserId(me.id()).forEach(g ->
                byEtablissement.computeIfAbsent(g.getEtablissementId(), k -> new ArrayList<>())
                        .add(g.getPermissionCode()));

        List<AccessibleEtablissement> result = new ArrayList<>();
        byEtablissement.forEach((etablissementId, codes) -> {
            Etablissement etab = etablissementRepository.findById(etablissementId).orElse(null);
            String name = etab != null ? etab.getName() : "Etablissement #" + etablissementId;
            result.add(new AccessibleEtablissement(etablissementId, name,
                    etab != null ? etab.getLatitude() : null,
                    etab != null ? etab.getLongitude() : null,
                    etab != null ? etab.getDescription() : null,
                    etab != null ? etab.getAddress() : null,
                    codes.stream().sorted().toList()));
        });
        return result;
    }
}
