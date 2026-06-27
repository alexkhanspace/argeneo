package net.argeneo.costing.repository;

import java.util.List;
import net.argeneo.costing.entity.SupplierInvoice;
import org.springframework.data.jpa.repository.JpaRepository;

/** Factures fournisseurs du tenant courant (filtrage tenant automatique). */
public interface SupplierInvoiceRepository extends JpaRepository<SupplierInvoice, Long> {

    List<SupplierInvoice> findAllByOrderByCreatedAtDesc();
}
