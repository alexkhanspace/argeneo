package net.argeneo.costing.api;

import java.util.Arrays;
import java.util.List;
import net.argeneo.costing.domain.MeasureDimension;
import net.argeneo.costing.domain.Unit;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Catalogue des unités de mesure (pour les listes déroulantes de l'UI). */
@RestController
@RequestMapping("/api/units")
public class UnitController {

    public record UnitResponse(String code, MeasureDimension dimension) {
    }

    @GetMapping
    public List<UnitResponse> list() {
        return Arrays.stream(Unit.values())
                .map(u -> new UnitResponse(u.name(), u.dimension()))
                .toList();
    }
}
