package net.argeneo.billing.repository;

import java.util.List;
import net.argeneo.billing.domain.BillingDocument;
import net.argeneo.billing.domain.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;

/** Documents de facturation du tenant courant (filtrage tenant automatique). */
public interface BillingDocumentRepository extends JpaRepository<BillingDocument, Long> {

    List<BillingDocument> findAllByOrderByCreatedAtDesc();

    List<BillingDocument> findByTypeOrderByCreatedAtDesc(DocumentType type);
}
