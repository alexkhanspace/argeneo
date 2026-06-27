package net.argeneo.costing.service;

import java.util.List;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.costing.api.dto.MenuDtos.MenuItemView;
import net.argeneo.costing.api.dto.MenuDtos.SaveMenuItem;
import net.argeneo.costing.api.dto.MenuDtos.SaveMenuRequest;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.entity.ArticleType;
import net.argeneo.costing.entity.MenuItem;
import net.argeneo.costing.repository.ArticleRepository;
import net.argeneo.costing.repository.MenuItemRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Gestion de la composition d'un article MENU (liste d'articles + quantités). */
@Service
public class MenuService {

    private final MenuItemRepository menuItemRepository;
    private final ArticleRepository articleRepository;

    public MenuService(MenuItemRepository menuItemRepository, ArticleRepository articleRepository) {
        this.menuItemRepository = menuItemRepository;
        this.articleRepository = articleRepository;
    }

    @Transactional(readOnly = true)
    public List<MenuItemView> get(Long menuArticleId) {
        requireMenu(menuArticleId);
        return menuItemRepository.findByMenuArticleIdOrderByPositionAsc(menuArticleId).stream()
                .map(it -> {
                    Article c = articleRepository.findById(it.getComponentArticleId()).orElse(null);
                    return new MenuItemView(it.getComponentArticleId(),
                            c != null ? c.getCode() : null,
                            c != null ? c.getName() : "Article #" + it.getComponentArticleId(),
                            it.getQuantity());
                })
                .toList();
    }

    @Transactional
    public void save(Long menuArticleId, SaveMenuRequest request) {
        requireMenu(menuArticleId);
        menuItemRepository.deleteByMenuArticleId(menuArticleId);
        int pos = 0;
        if (request.items() != null) {
            for (SaveMenuItem item : request.items()) {
                if (item.componentArticleId().equals(menuArticleId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Un menu ne peut pas se contenir lui-même.");
                }
                MenuItem mi = new MenuItem();
                mi.setMenuArticleId(menuArticleId);
                mi.setComponentArticleId(item.componentArticleId());
                mi.setQuantity(item.quantity());
                mi.setPosition(pos++);
                menuItemRepository.save(mi);
            }
        }
    }

    private void requireMenu(Long id) {
        Article a = articleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Article introuvable : " + id));
        if (a.getType() != ArticleType.MENU) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cet article n'est pas un menu.");
        }
    }
}
