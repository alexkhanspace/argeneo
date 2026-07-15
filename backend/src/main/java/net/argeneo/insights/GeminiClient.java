package net.argeneo.insights;

import com.google.auth.oauth2.GoogleCredentials;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import net.argeneo.config.ArgeneoProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Client Vertex AI (Gemini) : authentification par compte de service (jeton
 * OAuth2 rafraîchi automatiquement), puis appel REST {@code generateContent}.
 * Si le compte de service n'est pas configuré, {@link #isConfigured()} est faux
 * et la fonctionnalité se désactive proprement.
 */
@Component
public class GeminiClient {

    // Réponse Vertex (sous-ensemble) — désérialisée par RestClient/Jackson.
    private record VtxPart(String text) {
    }

    private record VtxContent(List<VtxPart> parts) {
    }

    private record VtxCandidate(VtxContent content) {
    }

    private record VtxResponse(List<VtxCandidate> candidates) {
    }

    // Réponse Imagen (predict) : images en base64.
    private record ImgPrediction(String bytesBase64Encoded, String mimeType) {
    }

    private record ImgResponse(List<ImgPrediction> predictions) {
    }

    // Réponse Gemini image (generateContent) : parties avec inlineData (image base64).
    private record InlineData(String mimeType, String data) {
    }

    private record InlinePart(String text, InlineData inlineData) {
    }

    private record InlineContent(List<InlinePart> parts) {
    }

    private record InlineCandidate(InlineContent content) {
    }

    private record InlineResponse(List<InlineCandidate> candidates) {
    }

    private final ArgeneoProperties.Gemini cfg;
    private final RestClient http = RestClient.create();
    private volatile GoogleCredentials credentials;

    public GeminiClient(ArgeneoProperties props) {
        this.cfg = props.gemini();
    }

    public boolean isConfigured() {
        return cfg != null
                && cfg.serviceAccountPath() != null
                && !cfg.serviceAccountPath().isBlank()
                && Files.exists(Path.of(cfg.serviceAccountPath()));
    }

    /** Envoie un prompt et renvoie le texte généré. */
    public String generate(String prompt) {
        try {
            String token = accessToken();
            String url = "https://" + cfg.location() + "-aiplatform.googleapis.com/v1/projects/"
                    + cfg.project() + "/locations/" + cfg.location()
                    + "/publishers/google/models/" + cfg.model() + ":generateContent";

            Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of(
                            "role", "user",
                            "parts", List.of(Map.of("text", prompt)))),
                    "generationConfig", Map.of(
                            "temperature", 0.7,
                            "maxOutputTokens", 1024,
                            // gemini-2.5-flash est un modèle « thinking » : sans ce budget à 0,
                            // le raisonnement interne consomme les tokens et tronque la réponse.
                            "thinkingConfig", Map.of("thinkingBudget", 0)));

            VtxResponse resp = http.post()
                    .uri(url)
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .retrieve()
                    .body(VtxResponse.class);

            if (resp == null || resp.candidates() == null || resp.candidates().isEmpty()) {
                return "";
            }
            StringBuilder sb = new StringBuilder();
            for (VtxPart p : resp.candidates().get(0).content().parts()) {
                if (p.text() != null) {
                    sb.append(p.text());
                }
            }
            return sb.toString().trim();
        } catch (Exception e) {
            throw new IllegalStateException("Appel Vertex/Gemini échoué : " + e.getMessage(), e);
        }
    }

    /** Génère une image (Imagen) à partir d'un prompt et renvoie les octets PNG. */
    public byte[] generateImage(String prompt) {
        try {
            String token = accessToken();
            String model = (cfg.imageModel() == null || cfg.imageModel().isBlank())
                    ? "imagen-3.0-generate-002" : cfg.imageModel();
            String url = "https://" + cfg.location() + "-aiplatform.googleapis.com/v1/projects/"
                    + cfg.project() + "/locations/" + cfg.location()
                    + "/publishers/google/models/" + model + ":predict";

            Map<String, Object> body = Map.of(
                    "instances", List.of(Map.of("prompt", prompt)),
                    "parameters", Map.of("sampleCount", 1, "aspectRatio", "1:1"));

            ImgResponse resp = http.post()
                    .uri(url)
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .retrieve()
                    .body(ImgResponse.class);

            if (resp == null || resp.predictions() == null || resp.predictions().isEmpty()
                    || resp.predictions().get(0).bytesBase64Encoded() == null) {
                throw new IllegalStateException("Imagen n'a renvoyé aucune image");
            }
            return java.util.Base64.getDecoder().decode(resp.predictions().get(0).bytesBase64Encoded());
        } catch (Exception e) {
            throw new IllegalStateException("Appel Vertex/Imagen échoué : " + e.getMessage(), e);
        }
    }

    /**
     * Génère une image à partir d'un texte via le modèle Gemini image (et non Imagen) : il suit
     * bien mieux la consigne « aucun texte », d'où des visuels sans charabia écrit.
     *
     * @param aspectRatio ratio souhaité (ex. « 1:1 », « 3:4 », « 9:16 ») transmis à l'IA pour que
     *                    le visuel épouse le format de sortie (sinon un rendu carré est rogné en A5).
     *                    {@code null}/vide => laisse le modèle choisir (rétro-compatible).
     */
    public byte[] generateFromText(String prompt, String aspectRatio) {
        try {
            String token = accessToken();
            String model = (cfg.imageEditModel() == null || cfg.imageEditModel().isBlank())
                    ? "gemini-2.5-flash-image" : cfg.imageEditModel();
            String url = "https://" + cfg.location() + "-aiplatform.googleapis.com/v1/projects/"
                    + cfg.project() + "/locations/" + cfg.location()
                    + "/publishers/google/models/" + model + ":generateContent";

            Map<String, Object> generationConfig = new java.util.LinkedHashMap<>();
            generationConfig.put("responseModalities", List.of("TEXT", "IMAGE"));
            if (aspectRatio != null && !aspectRatio.isBlank()) {
                generationConfig.put("imageConfig", Map.of("aspectRatio", aspectRatio));
            }
            Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of(
                            "role", "user",
                            "parts", List.of(Map.of("text", prompt)))),
                    "generationConfig", generationConfig);

            InlineResponse resp = http.post()
                    .uri(url)
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .retrieve()
                    .body(InlineResponse.class);

            if (resp != null && resp.candidates() != null) {
                for (InlineCandidate c : resp.candidates()) {
                    if (c.content() == null || c.content().parts() == null) {
                        continue;
                    }
                    for (InlinePart p : c.content().parts()) {
                        if (p.inlineData() != null && p.inlineData().data() != null) {
                            return java.util.Base64.getDecoder().decode(p.inlineData().data());
                        }
                    }
                }
            }
            throw new IllegalStateException("Gemini n'a renvoyé aucune image");
        } catch (Exception e) {
            throw new IllegalStateException("Appel Vertex/Gemini image (texte) échoué : " + e.getMessage(), e);
        }
    }

    /** generationConfig commun pour la génération d'image : modalités + ratio (imageConfig) si fourni. */
    private static Map<String, Object> imageGenConfig(String aspectRatio) {
        Map<String, Object> config = new java.util.LinkedHashMap<>();
        config.put("responseModalities", List.of("TEXT", "IMAGE"));
        if (aspectRatio != null && !aspectRatio.isBlank()) {
            config.put("imageConfig", Map.of("aspectRatio", aspectRatio));
        }
        return config;
    }

    /** Édite/transforme une image existante à partir d'une consigne (Gemini image). */
    public byte[] editImage(String prompt, byte[] inputImage, String inputMime, String aspectRatio) {
        try {
            String token = accessToken();
            String model = (cfg.imageEditModel() == null || cfg.imageEditModel().isBlank())
                    ? "gemini-2.5-flash-image" : cfg.imageEditModel();
            String url = "https://" + cfg.location() + "-aiplatform.googleapis.com/v1/projects/"
                    + cfg.project() + "/locations/" + cfg.location()
                    + "/publishers/google/models/" + model + ":generateContent";

            String b64 = java.util.Base64.getEncoder().encodeToString(inputImage);
            Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of(
                            "role", "user",
                            "parts", List.of(
                                    Map.of("text", prompt),
                                    Map.of("inlineData", Map.of("mimeType", inputMime, "data", b64))))),
                    "generationConfig", imageGenConfig(aspectRatio));

            InlineResponse resp = http.post()
                    .uri(url)
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .retrieve()
                    .body(InlineResponse.class);

            if (resp != null && resp.candidates() != null) {
                for (InlineCandidate c : resp.candidates()) {
                    if (c.content() == null || c.content().parts() == null) {
                        continue;
                    }
                    for (InlinePart p : c.content().parts()) {
                        if (p.inlineData() != null && p.inlineData().data() != null) {
                            return java.util.Base64.getDecoder().decode(p.inlineData().data());
                        }
                    }
                }
            }
            throw new IllegalStateException("Gemini n'a renvoyé aucune image");
        } catch (Exception e) {
            throw new IllegalStateException("Appel Vertex/Gemini image échoué : " + e.getMessage(), e);
        }
    }

    /**
     * Compose une image à partir de PLUSIEURS photos réelles + une consigne (Gemini image).
     * Utilisé pour les affiches « menu » : chaque photo de produit est envoyée telle quelle
     * et le modèle les met en scène dans un visuel unique.
     */
    public byte[] composeImages(String prompt, List<byte[]> images, List<String> mimes, String aspectRatio) {
        try {
            String token = accessToken();
            String model = (cfg.imageEditModel() == null || cfg.imageEditModel().isBlank())
                    ? "gemini-2.5-flash-image" : cfg.imageEditModel();
            String url = "https://" + cfg.location() + "-aiplatform.googleapis.com/v1/projects/"
                    + cfg.project() + "/locations/" + cfg.location()
                    + "/publishers/google/models/" + model + ":generateContent";

            List<Map<String, Object>> parts = new java.util.ArrayList<>();
            parts.add(Map.of("text", prompt));
            for (int i = 0; i < images.size(); i++) {
                String b64 = java.util.Base64.getEncoder().encodeToString(images.get(i));
                parts.add(Map.of("inlineData", Map.of("mimeType", mimes.get(i), "data", b64)));
            }
            Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of("role", "user", "parts", parts)),
                    "generationConfig", imageGenConfig(aspectRatio));

            InlineResponse resp = http.post()
                    .uri(url)
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .retrieve()
                    .body(InlineResponse.class);

            if (resp != null && resp.candidates() != null) {
                for (InlineCandidate c : resp.candidates()) {
                    if (c.content() == null || c.content().parts() == null) {
                        continue;
                    }
                    for (InlinePart p : c.content().parts()) {
                        if (p.inlineData() != null && p.inlineData().data() != null) {
                            return java.util.Base64.getDecoder().decode(p.inlineData().data());
                        }
                    }
                }
            }
            throw new IllegalStateException("Gemini n'a renvoyé aucune image");
        } catch (Exception e) {
            throw new IllegalStateException("Appel Vertex/Gemini image (composition) échoué : " + e.getMessage(), e);
        }
    }

    /**
     * Analyse multimodale : envoie un fichier (image ou PDF) + une consigne et renvoie le
     * TEXTE généré. Force {@code responseMimeType=application/json} pour une sortie JSON stricte
     * (utilisé pour l'extraction de factures fournisseurs).
     */
    public String extractStructured(byte[] file, String mime, String prompt) {
        try {
            String token = accessToken();
            String url = "https://" + cfg.location() + "-aiplatform.googleapis.com/v1/projects/"
                    + cfg.project() + "/locations/" + cfg.location()
                    + "/publishers/google/models/" + cfg.model() + ":generateContent";

            String b64 = java.util.Base64.getEncoder().encodeToString(file);
            Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of(
                            "role", "user",
                            "parts", List.of(
                                    Map.of("text", prompt),
                                    Map.of("inlineData", Map.of("mimeType", mime, "data", b64))))),
                    "generationConfig", Map.of(
                            // Extraction factuelle : température basse, pas de « thinking » qui
                            // tronquerait, gros budget de sortie (factures à nombreuses lignes).
                            "temperature", 0.1,
                            "maxOutputTokens", 8192,
                            "responseMimeType", "application/json",
                            "thinkingConfig", Map.of("thinkingBudget", 0)));

            VtxResponse resp = http.post()
                    .uri(url)
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .body(body)
                    .retrieve()
                    .body(VtxResponse.class);

            if (resp == null || resp.candidates() == null || resp.candidates().isEmpty()) {
                return "";
            }
            StringBuilder sb = new StringBuilder();
            for (VtxPart p : resp.candidates().get(0).content().parts()) {
                if (p.text() != null) {
                    sb.append(p.text());
                }
            }
            return sb.toString().trim();
        } catch (Exception e) {
            throw new IllegalStateException("Appel Vertex/Gemini (extraction) échoué : " + e.getMessage(), e);
        }
    }

    private synchronized String accessToken() throws IOException {
        if (credentials == null) {
            try (FileInputStream in = new FileInputStream(cfg.serviceAccountPath())) {
                credentials = GoogleCredentials.fromStream(in)
                        .createScoped(List.of("https://www.googleapis.com/auth/cloud-platform"));
            }
        }
        credentials.refreshIfExpired();
        return credentials.getAccessToken().getTokenValue();
    }
}
