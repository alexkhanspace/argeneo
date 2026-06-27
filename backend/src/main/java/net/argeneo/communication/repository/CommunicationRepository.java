package net.argeneo.communication.repository;

import java.util.List;
import net.argeneo.communication.entity.Communication;
import org.springframework.data.jpa.repository.JpaRepository;

/** Communications archivées du tenant courant (filtrage tenant automatique). */
public interface CommunicationRepository extends JpaRepository<Communication, Long> {

    List<Communication> findAllByOrderByCreatedAtDesc();
}
