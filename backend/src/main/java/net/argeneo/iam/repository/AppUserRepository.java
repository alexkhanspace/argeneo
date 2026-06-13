package net.argeneo.iam.repository;

import java.util.List;
import java.util.Optional;
import net.argeneo.iam.domain.AppUser;
import net.argeneo.iam.domain.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

/** Utilisateurs du tenant courant (filtrage tenant automatique via @TenantId). */
public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByEmail(String email);

    List<AppUser> findAllByRoleOrderByFullNameAsc(UserRole role);
}
