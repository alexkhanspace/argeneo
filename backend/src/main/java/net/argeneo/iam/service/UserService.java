package net.argeneo.iam.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.iam.api.dto.UserDtos.AssignPermissionsRequest;
import net.argeneo.iam.api.dto.UserDtos.BoulangeriePermissions;
import net.argeneo.iam.api.dto.UserDtos.CreateEmployeeRequest;
import net.argeneo.iam.api.dto.UserDtos.UserPermissionsResponse;
import net.argeneo.iam.api.dto.UserDtos.UserResponse;
import net.argeneo.iam.domain.AppUser;
import net.argeneo.iam.domain.PermissionGrant;
import net.argeneo.iam.domain.UserRole;
import net.argeneo.iam.repository.AppUserRepository;
import net.argeneo.iam.repository.BoulangerieRepository;
import net.argeneo.iam.repository.PermissionGrantRepository;
import net.argeneo.iam.repository.PermissionRepository;
import net.argeneo.security.AuthAccountReader;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gestion des utilisateurs métier et de leurs permissions (parcours Patron).
 * Toutes les opérations sont scopées au tenant courant via {@code @TenantId}.
 */
@Service
public class UserService {

    private final AppUserRepository userRepository;
    private final PermissionGrantRepository grantRepository;
    private final BoulangerieRepository boulangerieRepository;
    private final PermissionRepository permissionRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthAccountReader accountReader;

    public UserService(AppUserRepository userRepository,
                       PermissionGrantRepository grantRepository,
                       BoulangerieRepository boulangerieRepository,
                       PermissionRepository permissionRepository,
                       PasswordEncoder passwordEncoder,
                       AuthAccountReader accountReader) {
        this.userRepository = userRepository;
        this.grantRepository = grantRepository;
        this.boulangerieRepository = boulangerieRepository;
        this.permissionRepository = permissionRepository;
        this.passwordEncoder = passwordEncoder;
        this.accountReader = accountReader;
    }

    /** Crée le patron d'un tenant. À appeler avec le TenantContext déjà positionné. */
    @Transactional
    public AppUser createPatron(String email, String rawPassword, String fullName) {
        requireEmailAvailable(email);
        AppUser patron = new AppUser();
        patron.setEmail(normalize(email));
        patron.setPasswordHash(passwordEncoder.encode(rawPassword));
        patron.setFullName(fullName);
        patron.setRole(UserRole.PATRON);
        return userRepository.save(patron);
    }

    @Transactional
    public UserResponse createEmployee(CreateEmployeeRequest request) {
        requireEmailAvailable(request.email());
        AppUser employee = new AppUser();
        employee.setEmail(normalize(request.email()));
        employee.setPasswordHash(passwordEncoder.encode(request.password()));
        employee.setFullName(request.fullName());
        employee.setRole(UserRole.EMPLOYE);
        return UserResponse.from(userRepository.save(employee));
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listEmployees() {
        return userRepository.findAllByRoleOrderByFullNameAsc(UserRole.EMPLOYE)
                .stream().map(UserResponse::from).toList();
    }

    /** Remplace l'ensemble des permissions d'un employé sur une boulangerie. */
    @Transactional
    public void assignPermissions(Long userId, AssignPermissionsRequest request) {
        AppUser user = requireEmployee(userId);

        boulangerieRepository.findById(request.boulangerieId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Boulangerie introuvable: " + request.boulangerieId()));

        LinkedHashSet<String> codes = new LinkedHashSet<>(request.permissionCodes());
        for (String code : codes) {
            if (!permissionRepository.existsById(code)) {
                throw new IllegalArgumentException("Permission inconnue: " + code);
            }
        }

        grantRepository.deleteByUserIdAndBoulangerieId(user.getId(), request.boulangerieId());
        grantRepository.flush();
        for (String code : codes) {
            grantRepository.save(new PermissionGrant(user.getId(), request.boulangerieId(), code));
        }
    }

    @Transactional(readOnly = true)
    public UserPermissionsResponse getPermissions(Long userId) {
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable: " + userId));

        Map<Long, List<String>> byBoulangerie = new LinkedHashMap<>();
        for (PermissionGrant grant : grantRepository.findByUserId(user.getId())) {
            byBoulangerie.computeIfAbsent(grant.getBoulangerieId(), k -> new ArrayList<>())
                    .add(grant.getPermissionCode());
        }

        List<BoulangeriePermissions> result = byBoulangerie.entrySet().stream()
                .map(e -> new BoulangeriePermissions(e.getKey(), e.getValue().stream().sorted().toList()))
                .toList();
        return new UserPermissionsResponse(user.getId(), result);
    }

    private AppUser requireEmployee(Long userId) {
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable: " + userId));
        if (user.getRole() != UserRole.EMPLOYE) {
            throw new IllegalArgumentException("Les permissions ne s'attribuent qu'aux employés");
        }
        return user;
    }

    private void requireEmailAvailable(String email) {
        if (accountReader.findByEmail(normalize(email)).isPresent()) {
            throw new ConflictException("E-mail déjà utilisé: " + email);
        }
    }

    private String normalize(String email) {
        return email.trim().toLowerCase();
    }
}
