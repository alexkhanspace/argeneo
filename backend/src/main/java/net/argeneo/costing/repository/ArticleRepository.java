package net.argeneo.costing.repository;

import java.util.List;
import java.util.Optional;
import net.argeneo.costing.entity.Article;
import org.springframework.data.jpa.repository.JpaRepository;

/** Articles du tenant courant (filtrage tenant automatique). */
public interface ArticleRepository extends JpaRepository<Article, Long> {

    List<Article> findAllByOrderByCodeAsc();

    /** Dernier code attribué pour un préfixe ('A' ou 'R') dans le tenant courant. */
    Optional<Article> findFirstByCodeStartingWithOrderByCodeDesc(String prefix);

    boolean existsByFamilleId(Long familleId);

    boolean existsBySousFamilleId(Long sousFamilleId);
}
