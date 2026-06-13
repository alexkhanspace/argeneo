package net.argeneo.costing.repository;

import java.util.List;
import net.argeneo.costing.entity.Article;
import org.springframework.data.jpa.repository.JpaRepository;

/** Articles du tenant courant (filtrage tenant automatique). */
public interface ArticleRepository extends JpaRepository<Article, Long> {

    List<Article> findAllByOrderByNameAsc();
}
