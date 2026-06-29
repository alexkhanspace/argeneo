package net.argeneo.costing.api;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.config.ArgeneoProperties;
import net.argeneo.costing.api.dto.ArticleDtos.ArticleResponse;
import net.argeneo.costing.entity.Article;
import net.argeneo.costing.entity.FamilleScope;
import net.argeneo.costing.repository.ArticleRepository;
import net.argeneo.costing.repository.RecipeRepository;
import net.argeneo.costing.service.FamilleService;
import net.argeneo.insights.GeminiClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Upload de la photo d'un article (parcours Patron). Le fichier est servi via /api/media/{file}. */
@RestController
@PreAuthorize("hasRole('PATRON')")
public class ArticlePhotoController {

    private final ArticleRepository articleRepository;
    private final RecipeRepository recipeRepository;
    private final FamilleService familleService;
    private final GeminiClient gemini;
    private final Path uploadDir;

    public ArticlePhotoController(ArticleRepository articleRepository,
                                  RecipeRepository recipeRepository,
                                  FamilleService familleService,
                                  GeminiClient gemini,
                                  ArgeneoProperties properties) {
        this.articleRepository = articleRepository;
        this.recipeRepository = recipeRepository;
        this.familleService = familleService;
        this.gemini = gemini;
        this.uploadDir = Path.of(properties.uploads().dir());
    }

    /** Réponse enrichie des noms de famille/sous-famille (la photo ne les modifie pas). */
    private ArticleResponse toResponse(Article a, boolean hasRecipe) {
        Map<Long, String> names = familleService.namesByScope(FamilleScope.ARTICLE);
        return ArticleResponse.from(a, hasRecipe,
                names.get(a.getFamilleId()), names.get(a.getSousFamilleId()));
    }

    @PostConstruct
    void ensureDir() {
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new UncheckedIOException("Impossible de créer le dossier d'upload : " + uploadDir, e);
        }
    }

    @PostMapping("/api/articles/{id}/photo")
    @Transactional
    public ArticleResponse upload(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier vide");
        }
        Article article = articleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Article introuvable : " + id));

        String ext = extension(file.getOriginalFilename());
        String name = UUID.randomUUID().toString().replace("-", "") + ext;
        Path target = uploadDir.resolve(name);
        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Échec de l'écriture du fichier", e);
        }

        article.setPhotoFile(name);
        Article saved = articleRepository.save(article);
        boolean hasRecipe = recipeRepository.findByArticleId(id).isPresent();
        return toResponse(saved, hasRecipe);
    }

    public record GeneratePhotoRequest(String hint) {
    }

    /** Génère une photo d'article via l'IA (Imagen) et l'enregistre comme photo de l'article. */
    @PostMapping("/api/articles/{id}/photo/generate")
    @Transactional
    public ArticleResponse generate(@PathVariable Long id,
                                    @RequestBody(required = false) GeneratePhotoRequest req) {
        if (!gemini.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Génération d'image IA non configurée sur ce serveur");
        }
        Article article = articleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Article introuvable : " + id));

        byte[] image = gemini.generateImage(buildPrompt(article, req == null ? null : req.hint()));
        String name = UUID.randomUUID().toString().replace("-", "") + ".png";
        try {
            Files.write(uploadDir.resolve(name), image);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Échec de l'écriture de l'image générée", e);
        }

        article.setPhotoFile(name);
        Article saved = articleRepository.save(article);
        boolean hasRecipe = recipeRepository.findByArticleId(id).isPresent();
        return toResponse(saved, hasRecipe);
    }

    /** Construit un prompt de photographie produit fini appétissante (sans lister les ingrédients,
     *  ce qui poussait le modèle à les éparpiller). */
    private static String buildPrompt(Article article, String hint) {
        StringBuilder p = new StringBuilder();
        p.append("Photographie professionnelle et appétissante du PRODUIT FINI « ").append(article.getName())
                .append(" », tel qu'il est présenté et vendu en commerce de bouche artisanal français : ")
                .append("UN SEUL produit entier, assemblé, dressé et prêt à consommer, posé sur une assiette ")
                .append("ou un plan de travail");
        if (article.getDescription() != null && !article.getDescription().isBlank()) {
            p.append(". Description : ").append(article.getDescription().trim());
        }
        if (hint != null && !hint.isBlank()) {
            p.append(". ").append(hint.trim());
        }
        p.append(". Gros plan sur le produit fini, fond neutre clair, lumière naturelle douce, haute ")
                .append("qualité, style catalogue produit, sans texte ni logo. SURTOUT PAS de mise en scène ")
                .append("déstructurée, pas d'ingrédients crus, séparés, éparpillés ou en vrac autour.");
        return p.toString();
    }

    /** Extension minuscule avec le point (ex. ".jpg"), bornée aux types image courants. */
    private static String extension(String original) {
        String ext = StringUtils.getFilenameExtension(original);
        if (ext == null) {
            return "";
        }
        ext = ext.toLowerCase();
        return switch (ext) {
            case "jpg", "jpeg", "png", "webp", "gif" -> "." + ext;
            default -> "";
        };
    }
}
