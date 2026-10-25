package net.argeneo.ordering.repository;

import java.util.List;
import net.argeneo.ordering.entity.OrderSheet;
import org.springframework.data.jpa.repository.JpaRepository;

/** Cadenciers du tenant courant (filtrage tenant automatique). */
public interface OrderSheetRepository extends JpaRepository<OrderSheet, Long> {

    List<OrderSheet> findAllByOrderByNameAsc();
}
