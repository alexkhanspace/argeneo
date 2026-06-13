package net.argeneo.daily.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import net.argeneo.daily.domain.DailyEntry;
import org.springframework.data.jpa.repository.JpaRepository;

/** Saisies quotidiennes du tenant courant (filtrage tenant automatique). */
public interface DailyEntryRepository extends JpaRepository<DailyEntry, Long> {

    Optional<DailyEntry> findByEtablissementIdAndEntryDate(Long etablissementId, LocalDate entryDate);

    List<DailyEntry> findByEtablissementIdAndEntryDateBetweenOrderByEntryDateDesc(
            Long etablissementId, LocalDate from, LocalDate to);
}
