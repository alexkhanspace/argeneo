package net.argeneo.costing;

import net.argeneo.costing.domain.CostEngine;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Expose le moteur de coût (domaine pur) comme bean Spring. */
@Configuration
public class CostingConfig {

    @Bean
    CostEngine costEngine() {
        return new CostEngine();
    }
}
