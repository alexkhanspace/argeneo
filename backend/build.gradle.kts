plugins {
	java
	id("org.springframework.boot") version "4.1.0"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "net.argeneo"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(17)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.springframework.boot:spring-boot-starter-json")
	implementation("org.flywaydb:flyway-database-postgresql")

	// JWT (auth stateless)
	implementation("io.jsonwebtoken:jjwt-api:0.12.6")
	runtimeOnly("io.jsonwebtoken:jjwt-impl:0.12.6")
	runtimeOnly("io.jsonwebtoken:jjwt-jackson:0.12.6")

	// Google Vertex AI (Gemini) : auth compte de service -> jeton OAuth2.
	implementation("com.google.auth:google-auth-library-oauth2-http:1.30.1")

	// PDF facture : HTML -> PDF/A-3 (openhtmltopdf) + Factur-X / EN16931 (Mustang).
	implementation("com.openhtmltopdf:openhtmltopdf-core:1.0.10")
	implementation("com.openhtmltopdf:openhtmltopdf-pdfbox:1.0.10")
	// Mustang 2.9.x cible PDFBox 2.x (org.apache.pdfbox.pdmodel.PDDocument.load),
	// compatible avec openhtmltopdf 1.0.10 (PDFBox 2.0.24). Mustang 2.13.x exige
	// PDFBox 3.x (org.apache.pdfbox.Loader) et entre en conflit avec openhtmltopdf.
	implementation("org.mustangproject:library:2.9.0")
	// La "library" Mustang ne déclare pas ses dépendances runtime XML dans son POM
	// (jar shadé) : on les ajoute explicitement (dom4j/jaxen pour l'écriture XML).
	runtimeOnly("org.dom4j:dom4j:2.1.4")
	runtimeOnly("jaxen:jaxen:2.0.0")

	compileOnly("org.projectlombok:lombok")
	runtimeOnly("org.postgresql:postgresql")
	annotationProcessor("org.projectlombok:lombok")
	testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
	testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
	testImplementation("org.springframework.boot:spring-boot-starter-flyway-test")
	testImplementation("org.springframework.boot:spring-boot-starter-security-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testCompileOnly("org.projectlombok:lombok")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
	testAnnotationProcessor("org.projectlombok:lombok")
}

tasks.withType<Test> {
	useJUnitPlatform()
}
