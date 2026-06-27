package net.argeneo.billing.repository;

import net.argeneo.billing.domain.Client;
import org.springframework.data.jpa.repository.JpaRepository;

/** Clients du tenant courant (filtrage tenant automatique). */
public interface ClientRepository extends JpaRepository<Client, Long> {
}
