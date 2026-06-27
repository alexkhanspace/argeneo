package net.argeneo.iam.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import net.argeneo.audit.AuditService;
import net.argeneo.common.error.ConflictException;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.iam.api.dto.UserDtos.AssignPermissionsRequest;
import net.argeneo.iam.api.dto.UserDtos.EtablissementPermissions;
import net.argeneo.iam.api.dto.UserDtos.CreateEmployeeRequest;
import net.argeneo.iam.api.dto.UserDtos.UpdateEmployeeRequest;
import net.argeneo.iam.api.dto.UserDtos.UserPermissionsResponse;
import net.argeneo.iam.api.dto.UserDtos.UserResponse;
import net.argeneo.iam.domain.AppUser;
import net.argeneo.iam.domain.PermissionGrant;
import net.argeneo.iam.domain.UserRole;
import net.argeneo.iam.repository.AppUserRepository;
import net.argeneo.iam.repository.EtablissementRepository;
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
    private final EtablissementRepository etablissementRepository;
    private final PermissionRepository permissionRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthAccountReader accountReader;
    private final AuditService audit;

    public UserService(AppUserRepository userRepository,
                       PermissionGrantRepository grantRepository,
                       EtablissementRepository etablissementRepository,
                       PermissionRepository permissionRepository,
                       PasswordEncoder passwordEncoder,
                       AuthAccountReader accountReader,
                       AuditService audit) {
        this.userRepository = userRepository;
        this.grantRepository = grantRepository;
        this.etablissementRepository = etablissementRepository;
        this.permissionRepository = permissionRepository;
        this.passwordEncoder = passwordEncoder;
        this.accountReader = accountReader;
        this.audit = audit;
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
        AppUser saved = userRepository.save(employee);
        audit.record("USER_CREATE", "USER", saved.getId(), "Employé " + saved.getFullName());
        return UserResponse.from(saved);
    }

    /** Met à jour le nom complet et l'e-mail d'un employé. */
    @Transactional
    public UserResponse updateEmployee(Long userId, UpdateEmployeeRequest request) {
        AppUser employee = requireEmployee(userId);
        String newEmail = normalize(request.email());
        // Vérifie la disponibilité de l'e-mail seulement s'il change réellement.
        if (!newEmail.equals(employee.getEmail())) {
            requireEmailAvailable(newEmail);
            employee.setEmail(newEmail);
        }
        employee.setFullName(request.fullName());
        AppUser saved = userRepository.save(employee);
        audit.record("USER_UPDATE", "USER", saved.getId(), "Employé " + saved.getFullName());
        return UserResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listEmployees() {
        return userRepository.findAllByRoleOrderByFullNameAsc(UserRole.EMPLOYE)
                .stream().map(UserResponse::from).toList();
    }

    @Transactional
    public void deleteEmployee(Long userId) {
        AppUser user = requireEmployee(userId);
        // Les attributions de permissions sont supprimées en cascade (FK ON DELETE CASCADE).
        userRepository.delete(user);
        audit.record("USER_DELETE", "USER", userId, "Employé " + user.getFullName());
    }

    /** Remplace l'ensemble des permissions d'un employé sur une etablissement. */
    @Transactional
    public void assignPermissions(Long userId, AssignPermissionsRequest request) {
        AppUser user = requireEmployee(userId);

        etablissementRepository.findById(request.etablissementId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Etablissement introuvable: " + request.etablissementId()));

        LinkedHashSet<String> codes = new LinkedHashSet<>(request.permissionCodes());
        for (String code : codes) {
            if (!permissionRepository.existsById(code)) {
                throw new IllegalArgumentException("Permission inconnue: " + code);
            }
        }

        grantRepository.deleteByUserIdAndEtablissementId(user.getId(), request.etablissementId());
        grantRepository.flush();
        for (String code : codes) {
            grantRepository.save(new PermissionGrant(user.getId(), request.etablissementId(), code));
        }
    }

    @Transactional(readOnly = true)
    public UserPermissionsResponse getPermissions(Long userId) {
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable: " + userId));

        Map<Long, List<String>> byEtablissement = new LinkedHashMap<>();
        for (PermissionGrant grant : grantRepository.findByUserId(user.getId())) {
            byEtablissement.computeIfAbsent(grant.getEtablissementId(), k -> new ArrayList<>())
                    .add(grant.getPermissionCode());
        }

        List<EtablissementPermissions> result = byEtablissement.entrySet().stream()
                .map(e -> new EtablissementPermissions(e.getKey(), e.getValue().stream().sorted().toList()))
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
