package net.argeneo.daily.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.daily.api.dto.DailyDtos.DailyEntryResponse;
import net.argeneo.daily.domain.DailyEntry;
import net.argeneo.daily.repository.DailyEntryRepository;
import net.argeneo.iam.repository.EtablissementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Saisie quotidienne (CA, perte, mot du jour) par etablissement et par jour. */
@Service
public class DailyEntryService {

    private final DailyEntryRepository repository;
    private final EtablissementRepository etablissementRepository;

    public DailyEntryService(DailyEntryRepository repository,
                             EtablissementRepository etablissementRepository) {
        this.repository = repository;
        this.etablissementRepository = etablissementRepository;
    }

    @Transactional(readOnly = true)
    public DailyEntryResponse getDay(Long etablissementId, LocalDate date) {
        requireEtablissement(etablissementId);
        return repository.findByEtablissementIdAndEntryDate(etablissementId, date)
                .map(DailyEntryResponse::from)
                .orElseGet(() -> DailyEntryResponse.empty(etablissementId, date));
    }

    @Transactional(readOnly = true)
    public List<DailyEntryResponse> listRange(Long etablissementId, LocalDate from, LocalDate to) {
        requireEtablissement(etablissementId);
        return repository
                .findByEtablissementIdAndEntryDateBetweenOrderByEntryDateDesc(etablissementId, from, to)
                .stream().map(DailyEntryResponse::from).toList();
    }

    @Transactional
    public DailyEntryResponse setRevenue(Long etablissementId, LocalDate date, BigDecimal revenue) {
        DailyEntry entry = getOrCreate(etablissementId, date);
        entry.setRevenue(revenue);
        return DailyEntryResponse.from(repository.save(entry));
    }

    @Transactional
    public DailyEntryResponse setLoss(Long etablissementId, LocalDate date, BigDecimal loss) {
        DailyEntry entry = getOrCreate(etablissementId, date);
        entry.setLoss(loss);
        return DailyEntryResponse.from(repository.save(entry));
    }

    @Transactional
    public DailyEntryResponse setNote(Long etablissementId, LocalDate date, String note) {
        DailyEntry entry = getOrCreate(etablissementId, date);
        entry.setNoteOfDay(note == null || note.isBlank() ? null : note);
        return DailyEntryResponse.from(repository.save(entry));
    }

    private DailyEntry getOrCreate(Long etablissementId, LocalDate date) {
        requireEtablissement(etablissementId);
        return repository.findByEtablissementIdAndEntryDate(etablissementId, date)
                .orElseGet(() -> new DailyEntry(etablissementId, date));
    }

    /** Garantit que la etablissement appartient au tenant courant (sinon 404). */
    private void requireEtablissement(Long etablissementId) {
        etablissementRepository.findById(etablissementId)
                .orElseThrow(() -> new ResourceNotFoundException("Etablissement introuvable : " + etablissementId));
    }
}
