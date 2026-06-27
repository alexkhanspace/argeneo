package net.argeneo.costing.repository;

import java.util.List;
import net.argeneo.costing.entity.MenuItem;
import org.springframework.data.jpa.repository.JpaRepository;

/** Composants d'un article MENU (filtrage tenant automatique). */
public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {

    List<MenuItem> findByMenuArticleIdOrderByPositionAsc(Long menuArticleId);

    void deleteByMenuArticleId(Long menuArticleId);
}
