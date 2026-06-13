package net.argeneo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

// On gère l'authentification via JWT : pas d'utilisateur en mémoire par défaut.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class ArgeneoBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(ArgeneoBackendApplication.class, args);
	}

}
