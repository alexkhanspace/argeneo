package net.argeneo.costing.api;

import jakarta.validation.Valid;
import java.util.List;
import net.argeneo.costing.api.dto.MenuDtos.MenuItemView;
import net.argeneo.costing.api.dto.MenuDtos.SaveMenuRequest;
import net.argeneo.costing.service.MenuService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Composition d'un article MENU (parcours Patron). */
@RestController
@RequestMapping("/api/articles/{id}/menu")
@PreAuthorize("hasRole('PATRON')")
public class MenuController {

    private final MenuService menuService;

    public MenuController(MenuService menuService) {
        this.menuService = menuService;
    }

    @GetMapping
    public List<MenuItemView> get(@PathVariable Long id) {
        return menuService.get(id);
    }

    @PutMapping
    public List<MenuItemView> save(@PathVariable Long id, @Valid @RequestBody SaveMenuRequest request) {
        menuService.save(id, request);
        return menuService.get(id);
    }
}
