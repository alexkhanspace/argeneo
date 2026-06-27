package net.argeneo.billing.repository;

import net.argeneo.billing.domain.BillingDocumentLine;
import org.springframework.data.jpa.repository.JpaRepository;

/** Lignes de documents de facturation du tenant courant (filtrage tenant automatique). */
public interface BillingDocumentLineRepository extends JpaRepository<BillingDocumentLine, Long> {
}
