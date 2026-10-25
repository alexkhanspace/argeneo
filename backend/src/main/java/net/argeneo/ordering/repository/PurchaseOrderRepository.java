package net.argeneo.ordering.repository;

import java.util.List;
import net.argeneo.ordering.entity.PurchaseOrder;
import org.springframework.data.jpa.repository.JpaRepository;

/** Commandes fournisseurs du tenant courant (filtrage tenant automatique). */
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {

    List<PurchaseOrder> findTop200ByOrderByOrderDateDescIdDesc();

    List<PurchaseOrder> findTop200ByEtablissementIdInOrderByOrderDateDescIdDesc(List<Long> etablissementIds);
}
