package net.argeneo.insights.api;

import java.io.IOException;
import net.argeneo.insights.GeminiClient;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Édition d'image par IA (mise en scène d'une photo réelle pour une pub). */
@RestController
@PreAuthorize("hasRole('PATRON')")
public class AiImageController {

    private final GeminiClient gemini;

    public AiImageController(GeminiClient gemini) {
        this.gemini = gemini;
    }

    /** Sublime/met en scène une photo réelle (image-to-image), renvoie l'image PNG transformée. */
    @PostMapping("/api/ai/enhance-image")
    public ResponseEntity<byte[]> enhance(@RequestParam("file") MultipartFile file,
                                          @RequestParam(value = "ambiance", required = false) String ambiance,
                                          @RequestParam(value = "instruction", required = false) String instruction,
                                          @RequestParam(value = "mode", required = false) String mode) {
        if (!gemini.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "IA non configurée sur ce serveur");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier vide");
        }
        try {
            String mime = file.getContentType() != null ? file.getContentType() : "image/png";
            byte[] out = gemini.editImage(buildPrompt(ambiance, instruction, mode), file.getBytes(), mime);
            return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(out);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Lecture du fichier impossible", e);
        }
    }

    /**
     * Compose une affiche à partir de PLUSIEURS photos réelles (menu, sélection de produits) :
     * l'IA met en scène les produits fournis dans un visuel unique, sans texte, renvoyé en PNG.
     */
    @PostMapping("/api/ai/compose-image")
    public ResponseEntity<byte[]> compose(@RequestParam("files") java.util.List<MultipartFile> files,
                                          @RequestParam(value = "instruction", required = false) String instruction) {
        if (!gemini.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "IA non configurée sur ce serveur");
        }
        if (files == null || files.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucune photo fournie");
        }
        try {
            java.util.List<byte[]> images = new java.util.ArrayList<>();
            java.util.List<String> mimes = new java.util.ArrayList<>();
            // On borne à 8 photos : au-delà le visuel devient illisible et la requête trop lourde.
            for (MultipartFile f : files.subList(0, Math.min(files.size(), 8))) {
                if (f == null || f.isEmpty()) {
                    continue;
                }
                images.add(f.getBytes());
                mimes.add(f.getContentType() != null ? f.getContentType() : "image/png");
            }
            if (images.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Photos vides");
            }
            byte[] out = gemini.composeImages(composePrompt(instruction), images, mimes);
            return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(out);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Lecture des fichiers impossible", e);
        }
    }

    private static String composePrompt(String instruction) {
        StringBuilder p = new StringBuilder();
        p.append("Compose UNE seule affiche publicitaire (visuel unique, orientation portrait) pour un commerce ")
                .append("de bouche artisanal français à partir des photos RÉELLES fournies. GARDE FIDÈLEMENT chaque ")
                .append("produit tel qu'il est (forme, couleurs, garniture) — ne les remplace pas par des produits ")
                .append("génériques et n'en invente pas d'autres. Détoure-les et mets-les en scène ensemble dans une ")
                .append("composition harmonieuse, appétissante et professionnelle (lumière naturelle douce, style ")
                .append("photo studio, rendu chaleureux). Laisse des zones visuellement calmes en haut et en bas ")
                .append("pour que du texte puisse être ajouté ensuite. ");
        if (instruction != null && !instruction.isBlank()) {
            p.append("CONSIGNE DU CLIENT (à respecter en priorité) : ").append(instruction.trim()).append(". ");
        }
        p.append("Ne fais apparaître AUCUN texte, chiffre ni logo sur l'image.");
        return p.toString();
    }

    public record GenerateImageRequest(String prompt) {
    }

    /** Génère un visuel à partir d'un brief libre (texte→image), pour la page Communication. */
    @PostMapping("/api/ai/generate-image")
    public ResponseEntity<byte[]> generateImage(@RequestBody GenerateImageRequest req) {
        if (!gemini.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "IA non configurée sur ce serveur");
        }
        if (req == null || req.prompt() == null || req.prompt().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Brief vide");
        }
        String prompt = "Crée un visuel publicitaire soigné et appétissant pour un commerce de bouche artisanal "
                + "française artisanale : style photo professionnelle, haute qualité, lumière naturelle douce, "
                + "fond épuré. Ne fais apparaître AUCUN texte ni logo sur l'image (aucune lettre, aucun mot, "
                + "aucune pancarte, aucune étiquette, aucun emballage imprimé). Sujet : " + req.prompt().trim() + ".";
        byte[] out = gemini.generateFromText(prompt);
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(out);
    }

    private static String buildPrompt(String ambiance, String instruction, String mode) {
        StringBuilder p = new StringBuilder();
        if ("scene".equalsIgnoreCase(mode)) {
            // Mode Communication : photo d'événement/scène (personnes, objets) à préserver fidèlement.
            p.append("Transforme cette photo en VISUEL DE COMMUNICATION soigné pour un commerce de bouche artisanal ")
                    .append("française. GARDE FIDÈLEMENT la scène : les personnes, les objets et l'action présents ")
                    .append("restent identiques (ne supprime personne, ne change pas leur nature ni leur nombre). ")
                    .append("Tu peux détourer/nettoyer le fond, ou le REMPLACER si une ambiance est demandée. ")
                    .append("Améliore la lumière, la netteté, les couleurs et le cadrage pour un rendu professionnel ")
                    .append("et chaleureux. ");
        } else {
            // Mode produit (pub d'un article).
            p.append("Transforme cette photo en VISUEL PUBLICITAIRE soigné pour un commerce de bouche artisanal. ")
                    .append("GARDE EXACTEMENT le même produit (forme, couleur, garniture) — ne le modifie pas, ne le ")
                    .append("déstructure pas, ne change pas sa nature. Détoure proprement le produit de son fond ")
                    .append("d'origine. Tu PEUX le réorienter, l'incliner, le recadrer ou le repositionner pour la ")
                    .append("composition la plus flatteuse (par exemple le présenter couché ou en biais plutôt que ")
                    .append("droit et figé) tant que cela reste le même produit. METS-LE BIEN EN VALEUR : il doit être ")
                    .append("le héros de l'image, sublimé et mis en avant (textures appétissantes, fraîcheur, ")
                    .append("gourmandise, reflets et matières soignés), comme dans une vraie publicité. Améliore la ")
                    .append("lumière, la netteté et la mise en scène, façon photo studio appétissante. ");
        }
        if (ambiance != null && !ambiance.isBlank()) {
            p.append("Ambiance / décor / fond souhaités : ").append(ambiance.trim()).append(". ");
        }
        if (instruction != null && !instruction.isBlank()) {
            p.append("CONSIGNE DU CLIENT (à respecter en priorité) : ").append(instruction.trim()).append(". ");
        }
        p.append("Cadrage net, haute qualité, sans aucun texte ni logo ajouté.");
        return p.toString();
    }
}
