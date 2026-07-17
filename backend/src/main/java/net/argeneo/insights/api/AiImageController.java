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
                                          @RequestParam(value = "mode", required = false) String mode,
                                          @RequestParam(value = "aspectRatio", required = false) String aspectRatio) {
        if (!gemini.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "IA non configurée sur ce serveur");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier vide");
        }
        try {
            String mime = file.getContentType() != null ? file.getContentType() : "image/png";
            byte[] out = gemini.editImage(buildPrompt(ambiance, instruction, mode), file.getBytes(), mime,
                    aspect(aspectRatio));
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
                                          @RequestParam(value = "instruction", required = false) String instruction,
                                          @RequestParam(value = "aspectRatio", required = false) String aspectRatio,
                                          @RequestParam(value = "mode", required = false) String mode) {
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
            String prompt = "isolate".equalsIgnoreCase(mode) ? isolatePrompt(instruction) : composePrompt(instruction);
            byte[] out = gemini.composeImages(prompt, images, mimes, aspect(aspectRatio));
            return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(out);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Lecture des fichiers impossible", e);
        }
    }

    /**
     * Détourage sur chroma-key : isole le(s) produit(s) sur un aplat MAGENTA pur, que l'application
     * retire ensuite pour poser le produit sur la couleur EXACTE de l'enseigne (peinte côté client).
     */
    private static String isolatePrompt(String instruction) {
        boolean improve = instruction != null && !instruction.isBlank();
        StringBuilder p = new StringBuilder();
        p.append("Isole le(s) produit(s) réel(s) fourni(s) et place-le(s), bien centré(s), nets et mis en "
                + "valeur, sur un FOND PARFAITEMENT UNIFORME de MAGENTA PUR (rose-violet vif, RVB 255,0,255, "
                + "hex #FF00FF) : un aplat TOTAL et STRICTEMENT UNI d'un seul et même magenta sur TOUTE la "
                + "surface du fond, SANS aucun dégradé, SANS variation de teinte, SANS texture, SANS ombre "
                + "portée ni reflet au sol, SANS vignettage, SANS aucune autre couleur ni décor. ");
        if (improve) {
            // Mode « détourer et améliorer » : on autorise l'embellissement photo + la consigne du client.
            p.append("Tu PEUX embellir le rendu du produit (lumière plus flatteuse, meilleure netteté, "
                    + "couleurs plus appétissantes, fraîcheur, matières et textures soignées, rendu photo "
                    + "studio) SANS changer sa NATURE, sa FORME, sa recette ni sa garniture, et SANS le faire "
                    + "pivoter ni l'incliner. CONSIGNE DU CLIENT (à respecter en priorité) : ")
                    .append(instruction.trim()).append(". ");
        } else {
            p.append("GARDE chaque produit STRICTEMENT identique (forme, couleurs, garniture, texture) et "
                    + "dans SON ORIENTATION D'ORIGINE : NE le fais PAS pivoter, NE le tourne PAS, NE l'incline "
                    + "PAS, ne le remplace pas, n'en invente pas d'autres. ");
        }
        p.append("Le magenta ne doit toucher QUE le fond, jamais le produit. Aucun texte, aucun logo, aucun "
                + "filigrane / watermark ni logo/nom de banque d'images (Vecteezy, Shutterstock, Getty, "
                + "iStock, Adobe Stock, Freepik, Depositphotos, Alamy…).");
        return p.toString();
    }

    private static String composePrompt(String instruction) {
        StringBuilder p = new StringBuilder();
        p.append("Compose UNE seule affiche publicitaire en FORMAT PORTRAIT VERTICAL, nettement PLUS HAUTE ")
                .append("QUE LARGE (type affiche A5, ratio ~3:4) — NE rends PAS une image carrée — pour un commerce ")
                .append("de bouche artisanal français à partir des photos RÉELLES fournies. GARDE FIDÈLEMENT chaque ")
                .append("produit tel qu'il est (forme, couleurs, garniture) — ne les remplace pas par des produits ")
                .append("génériques et n'en invente pas d'autres. Détoure-les et mets-les en scène ensemble dans une ")
                .append("composition harmonieuse, appétissante et professionnelle (lumière naturelle douce, style ")
                .append("photo studio, rendu chaleureux). Laisse des zones visuellement calmes en haut et en bas ")
                .append("pour que du texte puisse être ajouté ensuite. ");
        if (instruction != null && !instruction.isBlank()) {
            p.append("CONSIGNE DU CLIENT (à respecter en priorité) : ").append(instruction.trim()).append(". ");
        }
        p.append("Ne fais apparaître AUCUN texte, chiffre ni logo sur l'image, et AUCUN filigrane / "
                + "watermark ni logo/nom de banque d'images (Vecteezy, Shutterstock, Getty, iStock, "
                + "Adobe Stock, Freepik, Depositphotos, Alamy…).");
        return p.toString();
    }

    // Ratios acceptés par le modèle Gemini image : on ne transmet qu'une valeur de cette liste
    // (une valeur inconnue ferait échouer l'appel Vertex), sinon on laisse le modèle décider.
    private static final java.util.Set<String> ASPECT_RATIOS = java.util.Set.of(
            "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9");

    /** Ne renvoie le ratio que s'il est accepté par le modèle (sinon null → le modèle décide). */
    private static String aspect(String ratio) {
        return ratio != null && ASPECT_RATIOS.contains(ratio) ? ratio : null;
    }

    public record GenerateImageRequest(String prompt, String aspectRatio) {
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
        // Format demandé (carré, A5…) : on le donne à l'IA à la fois via l'API (imageConfig) ET en
        // toutes lettres dans le prompt — beaucoup de modèles ignorent le ratio API et rendent du carré,
        // qui se retrouve alors rogné une fois placé dans une affichette A5.
        String aspectRatio = req.aspectRatio() != null && ASPECT_RATIOS.contains(req.aspectRatio())
                ? req.aspectRatio() : null;
        String prompt = "Crée un visuel publicitaire soigné et appétissant pour un commerce de bouche "
                + "artisanal français : style photo professionnelle, haute qualité, lumière naturelle douce, "
                + "fond épuré. " + orientationHint(aspectRatio)
                + "Ne fais apparaître AUCUN texte ni logo sur l'image (aucune lettre, aucun mot, "
                + "aucune pancarte, aucune étiquette, aucun emballage imprimé), et SURTOUT AUCUN "
                + "filigrane / watermark ni logo ou nom de banque d'images (Vecteezy, Shutterstock, "
                + "Getty, iStock, Adobe Stock, Freepik, Depositphotos, Alamy…). Sujet : " + req.prompt().trim() + ".";
        byte[] out = gemini.generateFromText(prompt, aspectRatio);
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).body(out);
    }

    /** Consigne de cadrage en toutes lettres selon le ratio (le modèle suit mieux le texte que l'API). */
    private static String orientationHint(String aspectRatio) {
        if (aspectRatio == null) {
            return "";
        }
        String[] p = aspectRatio.split(":");
        if (p.length != 2) {
            return "";
        }
        try {
            double w = Double.parseDouble(p[0]);
            double h = Double.parseDouble(p[1]);
            if (h > w) {
                return "IMPÉRATIF SUR LE CADRAGE : rends l'image en FORMAT PORTRAIT VERTICAL, nettement "
                        + "PLUS HAUTE QUE LARGE (ratio " + aspectRatio + ", proche d'une affiche A5). "
                        + "Compose la scène verticalement, sujet centré, avec de l'espace calme en haut et "
                        + "en bas. NE rends PAS une image carrée. ";
            }
            if (w > h) {
                return "IMPÉRATIF SUR LE CADRAGE : rends l'image en FORMAT PAYSAGE HORIZONTAL, plus LARGE "
                        + "que haute (ratio " + aspectRatio + "). NE rends PAS une image carrée. ";
            }
            return "Rends l'image en FORMAT CARRÉ (ratio 1:1). ";
        } catch (NumberFormatException e) {
            return "";
        }
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
        p.append("Cadrage net, haute qualité, sans aucun texte ni logo ajouté, et AUCUN filigrane / "
                + "watermark ni logo/nom de banque d'images (Vecteezy, Shutterstock, Getty, iStock, "
                + "Adobe Stock, Freepik, Depositphotos, Alamy…).");
        return p.toString();
    }
}
