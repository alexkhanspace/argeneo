package net.argeneo.insights;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import java.util.concurrent.ConcurrentHashMap;
import net.argeneo.config.ArgeneoProperties;
import net.argeneo.insights.api.dto.InsightDtos.DayAdvice;
import net.argeneo.insights.api.dto.InsightDtos.DayAnalysisItem;
import net.argeneo.insights.api.dto.InsightDtos.DayAnalysisRequest;
import net.argeneo.insights.api.dto.InsightDtos.DayAnalysisResponse;
import net.argeneo.insights.api.dto.InsightDtos.DayItem;
import net.argeneo.insights.api.dto.InsightDtos.DaysAnalysisRequest;
import net.argeneo.insights.api.dto.InsightDtos.DaysAnalysisResponse;
import net.argeneo.insights.api.dto.InsightDtos.AdCopyRequest;
import net.argeneo.insights.api.dto.InsightDtos.AdCopyResponse;
import net.argeneo.insights.api.dto.InsightDtos.DayContext;
import net.argeneo.insights.api.dto.InsightDtos.PricingRequest;
import net.argeneo.insights.api.dto.InsightDtos.PricingResponse;
import net.argeneo.insights.api.dto.InsightDtos.SocialPostRequest;
import net.argeneo.insights.api.dto.InsightDtos.SocialPostResponse;
import net.argeneo.insights.api.dto.InsightDtos.TrendRequest;
import net.argeneo.insights.api.dto.InsightDtos.TrendResponse;
import org.springframework.stereotype.Service;

/** Construit le prompt « avis de tendance » et interroge Gemini (réponse par jour). */
@Service
public class InsightService {

    /** Repères météo/événements génériques, à ADAPTER au type d'établissement (pas spécifiques boulangerie). */
    private static final String METIER =
            "Repères généraux (à ADAPTER au TYPE D'ÉTABLISSEMENT indiqué ci-dessus, et à n'utiliser que si le "
            + "contexte du jour s'y prête) : beau temps + WEEK-END, jour férié ou pont → barbecues, pique-niques "
            + "et sorties → hausse des produits associés SELON LE COMMERCE (viandes et grillades pour une boucherie, "
            + "pain et sandwichs pour une boulangerie, boissons et glaces, traiteur…) — PAS un jour de semaine "
            + "ordinaire, et PAS s'il pleut (averses, bruine, orage) ; forte chaleur/canicule → boissons fraîches "
            + "en hausse, produits fragiles (crème, chocolat, glaçage) en baisse ; PLUIE, averses ou froid → "
            + "produits réconfortants et plats chauds, pas de barbecue ; certaines fêtes → produits de "
            + "tradition. ATTENTION : un JOUR FÉRIÉ n'implique PAS mécaniquement plus d'affluence — selon le "
            + "commerce et le lieu, il peut au contraire FAIRE BAISSER l'activité (clients partis, fermetures) ; "
            + "ne suppose jamais une hausse par défaut, appuie-toi sur le CHIFFRE RÉEL de la même fête l'an dernier.\n";

    /** Garde-fou anti-hallucination : interdit d'inventer des montants absents des données. */
    private static final String NO_INVENT =
            "RÈGLE ABSOLUE — N'INVENTE JAMAIS DE CHIFFRES. N'utilise QUE les données fournies ci-dessous. "
            + "Si une donnée (CA du jour, CA de l'an dernier, fréquentation, ticket moyen) n'est PAS fournie, "
            + "ne la cite pas, ne l'estime pas et n'affiche aucun montant en euros que tu n'as pas reçu. "
            + "En l'absence de CA de l'an dernier, ne fais AUCUNE comparaison chiffrée de chiffre d'affaires : "
            + "base-toi uniquement sur la météo et les événements. Les pourcentages ne portent que sur les "
            + "QUANTITÉS à produire (ex. « +20 % de pain »), jamais sur un chiffre d'affaires inconnu.\n";

    /** Avertissement : les fêtes mobiles ne tombent pas à la même date d'une année sur l'autre. */
    private static final String EVENTS_NOTE =
            "ATTENTION aux fêtes MOBILES (Fête des Mères, Fête des Pères, Pâques, Pentecôte, Ascension, "
            + "Aïd, etc.) : elles tombent un jour différent chaque année. Le même jour de semaine ou la même "
            + "date l'an dernier n'avait peut-être PAS la même fête. Compare en tenant compte des événements "
            + "fournis pour CHAQUE jour, et ne suppose pas qu'une fête de cette année existait à la référence.\n";

    /** Style : court et simple, comme on parle à un commerçant pressé (pas de blabla). */
    private static final String STYLE =
            "STYLE — Parle SIMPLEMENT et BRIÈVEMENT, comme à un commerçant pressé : phrases courtes, "
            + "mots courants, AUCUN jargon, pas d'introduction ni de conclusion, droit au but.\n";

    /** Durée de vie d'une analyse en cache (ms). Les données du jour (CA, météo…) bougent peu dans la journée. */
    private static final long CACHE_TTL_MS = 3 * 60 * 60 * 1000L;
    /** Plafond du cache : au-delà on purge les entrées expirées (puis tout si nécessaire). */
    private static final int CACHE_MAX = 500;

    private record CacheEntry(String value, long expiresAt) {
    }

    /** Cache mémoire des analyses : clé = signature (établissement + jour + mode + baseline + données). */
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private final GeminiClient gemini;
    private final ArgeneoProperties props;

    public InsightService(GeminiClient gemini, ArgeneoProperties props) {
        this.gemini = gemini;
        this.props = props;
    }

    public TrendResponse trend(TrendRequest req) {
        if (!gemini.isConfigured()) {
            return new TrendResponse(false, null, List.of());
        }
        String raw = gemini.generate(buildPrompt(req));
        return new TrendResponse(true, props.gemini().model(), parse(raw));
    }

    /** Métier / gamme de l'établissement pour les prompts (défaut historique : boulangerie). */
    private String metier(String description) {
        return notBlank(description) ? description : "boulangerie-pâtisserie artisanale française";
    }

    /** En-tête commun : rôle + métier réel + localisation de l'établissement (rien de codé en dur). */
    private String header(String etablissement, String location, String description) {
        StringBuilder h = new StringBuilder();
        h.append("Tu es un conseiller pour l'établissement « ").append(etablissement).append(" » (")
                .append(metier(description)).append(")");
        if (notBlank(location)) {
            h.append(", situé à ").append(location)
                    .append(" (tiens compte du climat, des habitudes et des événements locaux de ce secteur)");
        }
        h.append(".\n");
        return h.toString();
    }

    private String buildPrompt(TrendRequest req) {
        StringBuilder p = new StringBuilder();
        p.append(header(req.etablissement(), req.location(), req.description()));
        if (notBlank(req.description())) {
            p.append("TYPE D'ÉTABLISSEMENT (à respecter STRICTEMENT) : ").append(req.description()).append(".\n")
                    .append("Ne propose QUE des produits cohérents avec ce type d'établissement et sa gamme. ")
                    .append("Reste STRICTEMENT dans sa gamme : n'invente aucun produit qu'il ne vend pas.\n");
        }
        p.append(METIER);
        p.append(NO_INVENT);
        p.append(EVENTS_NOTE);
        p.append(STYLE);
        p.append(baselineRule(req.baseline()));
        p.append("Analyse les jours ci-dessous et donne un conseil de PRODUCTION / APPROVISIONNEMENT ")
                .append("UNIQUEMENT pour les jours à enjeu (fête, météo marquante, écart de CA vs an dernier).\n")
                .append("RAPPEL IMPORTANT — un JOUR FÉRIÉ ou une FÊTE n'implique PAS forcément une hausse : ")
                .append("quand le « CA N-1 (même date) » de la même fête l'an dernier est fourni, APPUIE-TOI ")
                .append("dessus (s'il était FAIBLE, prévois une journée calme, ne recommande PAS d'augmenter). ")
                .append("Ne chiffre un écart QUE s'il est réellement justifié, et PRÉCISE toujours la base ")
                .append("(ex. « vs le 14 juillet l'an dernier ») ; sinon conseille « comme l'an dernier ».\n\n")
                .append("FORMAT DE RÉPONSE STRICT : une ligne par jour notable, exactement\n")
                .append("AAAA-MM-JJ | conseil court et actionnable\n")
                .append("(ex. « 2026-06-21 | Fête de la Musique + beau temps : prévois plus de produits à ")
                .append("emporter et boissons fraîches, comme l'an dernier »).\n")
                .append("Un conseil de 120 caractères max, concret ; chiffre un écart seulement si un ")
                .append("facteur réel le justifie et précise la base. ")
                .append("N'inclus PAS les jours sans enjeu. Aucune autre ligne, pas d'introduction ni de puces.\n\n")
                .append("Données :\n");

        for (DayContext d : req.days()) {
            p.append("- ").append(d.date());
            if (notBlank(d.weekday())) p.append(" (").append(d.weekday()).append(")");
            p.append(" : ").append(dayLine(d)).append("\n");
        }
        return p.toString();
    }

    /** Analyse d'UNE journée (tableau de bord) — répond toujours, avec cache. */
    public DayAnalysisResponse dayAnalysis(DayAnalysisRequest req) {
        if (!gemini.isConfigured()) {
            return new DayAnalysisResponse(false, null, "Analyse IA non configurée sur ce serveur.");
        }
        boolean detail = Boolean.TRUE.equals(req.detail());
        String key = cacheKey(req.etablissement(), req.description(), req.location(), req.baseline(),
                req.mode(), detail, req.day());
        String cached = cacheGet(key);
        if (cached != null) {
            return new DayAnalysisResponse(true, props.gemini().model(), cached);
        }
        StringBuilder p = new StringBuilder(commonPreamble(req.etablissement(), req.location(),
                req.description(), req.baseline()));
        appendDayBlock(p, req.day(), req.mode(), detail);
        String out = gemini.generate(p.toString());
        cachePut(key, out);
        return new DayAnalysisResponse(true, props.gemini().model(), out);
    }

    /**
     * Analyse PLUSIEURS journées (J-1 / J / J+1) en un seul appel Gemini — pour le tableau de bord.
     * Chaque analyse est renvoyée avec sa date. Le résultat est mis en cache par batch (clé =
     * concaténation des signatures) : un rechargement du cockpit à données inchangées ne rappelle pas l'IA.
     */
    public DaysAnalysisResponse daysAnalysis(DaysAnalysisRequest req) {
        if (!gemini.isConfigured()) {
            return new DaysAnalysisResponse(false, null, List.of());
        }
        List<DayItem> items = req.items();
        StringJoiner keyJoiner = new StringJoiner("||", "batch[", "]");
        for (DayItem it : items) {
            keyJoiner.add(cacheKey(req.etablissement(), req.description(), req.location(), req.baseline(),
                    it.mode(), Boolean.TRUE.equals(it.detail()), it.day()));
        }
        String key = keyJoiner.toString();

        String raw = cacheGet(key);
        if (raw == null) {
            StringBuilder p = new StringBuilder(commonPreamble(req.etablissement(), req.location(),
                    req.description(), req.baseline()));
            p.append("Tu dois analyser PLUSIEURS journées ci-dessous. Pour CHAQUE journée, écris son ")
                    .append("analyse en la faisant précéder EXACTEMENT d'une ligne marqueur « ===AAAA-MM-JJ=== » ")
                    .append("(la date de la journée concernée), puis l'analyse en dessous. N'écris rien d'autre ")
                    .append("(aucun titre, aucune autre ligne).\n\n");
            for (DayItem it : items) {
                p.append("========================================\n")
                        .append("JOURNÉE À ANALYSER : ").append(it.day().date())
                        .append(" (marqueur attendu : ===").append(it.day().date()).append("===)\n");
                appendDayBlock(p, it.day(), it.mode(), Boolean.TRUE.equals(it.detail()));
            }
            raw = gemini.generate(p.toString());
            cachePut(key, raw);
        }

        Map<String, String> byDate = parseBatch(raw);
        List<DayAnalysisItem> out = new ArrayList<>();
        for (DayItem it : items) {
            String text = byDate.get(it.day().date());
            // Repli : si un seul jour et pas de marqueur, on prend la réponse brute.
            if (text == null && items.size() == 1) {
                text = raw == null ? "" : raw.trim();
            }
            out.add(new DayAnalysisItem(it.day().date(), it.mode(), text == null ? "" : text));
        }
        return new DaysAnalysisResponse(true, props.gemini().model(), out);
    }

    /** Préambule commun à toutes les analyses jour : rôle, gamme, règles et base de comparaison. */
    private String commonPreamble(String etablissement, String location, String description, String baseline) {
        StringBuilder p = new StringBuilder();
        p.append(header(etablissement, location, description));
        if (notBlank(description)) {
            p.append("Type d'établissement (à respecter STRICTEMENT, aucun produit hors gamme) : ")
                    .append(description).append(".\n");
        }
        p.append(METIER);
        p.append(NO_INVENT);
        p.append(EVENTS_NOTE);
        p.append(STYLE);
        p.append(baselineRule(baseline));
        return p.toString();
    }

    /** Consigne du mode + données du jour + notes conditionnelles + éventuel « développer ». */
    private void appendDayBlock(StringBuilder p, DayContext d, String modeRaw, boolean detail) {
        String mode = modeRaw == null ? "" : modeRaw;
        boolean bilan = "bilan".equalsIgnoreCase(mode);
        boolean prep = "prep".equalsIgnoreCase(mode);
        String jour = d.date() + (notBlank(d.weekday()) ? " (" + d.weekday() + ")" : "");
        if (prep) {
            // J+1 : que PRÉPARER pour demain (orienté production/appro).
            p.append("Demain, le ").append(jour)
                    .append(". Dis au patron CE QU'IL DOIT PRÉPARER POUR DEMAIN pour la production et ")
                    .append("l'approvisionnement : quoi produire en plus ou en moins, quoi commander, ")
                    .append("selon les événements de demain, la météo prévue et le CA de l'an dernier ")
                    .append("(simple référence de fréquentation). Si un jour férié, un pont ou un événement ")
                    .append("à forte affluence suit juste après (voir « événement(s) à venir »), tiens-en compte. ")
                    .append("NE FAIS PAS d'analyse du chiffre d'affaires (la journée n'a pas eu lieu). ")
                    .append("Reste strictement dans la gamme. 1 à 2 phrases COURTES, ton direct et ")
                    .append("impératif, concret, pas de puces, pas de titre.\n\n");
        } else if (!bilan) {
            // J : que FAIRE aujourd'hui (production/appro) + veille de férié + lecture CA légère.
            p.append("Nous sommes le ").append(jour)
                    .append(". Dis au patron CE QU'IL DOIT FAIRE AUJOURD'HUI pour la production et ")
                    .append("l'approvisionnement : quoi produire en plus ou en moins, quoi commander, ")
                    .append("en te basant sur les événements du jour, la météo et une référence FIABLE ")
                    .append("de fréquentation. IMPORTANT — si DEMAIN est férié, un pont ou à forte ")
                    .append("affluence (voir « événement(s) à venir »), signale que c'est une VEILLE et ")
                    .append("qu'il faut PRÉPARER dès aujourd'hui en conséquence ; NE cite PAS de chiffres ")
                    .append("pour demain ici (le détail chiffré est donné sur la carte de demain). Si le CA ")
                    .append("du jour est DÉJÀ saisi ET la référence N-1 fiable (ni férié atypique, ni 0 €), ")
                    .append("tu peux le situer en UNE phrase. Reste strictement dans la gamme. 1 à 2 phrases ")
                    .append("COURTES, ton direct et impératif, concret, pas de puces, pas de titre.\n\n");
        } else {
            // J-1/J-2 : journée FINIE -> bilan ANALYTIQUE, verdict + écart de CA chiffré.
            p.append("La journée ").append(jour)
                    .append(" est TERMINÉE : fais-en l'ANALYSE pour le patron. ")
                    .append("COMMENCE par un VERDICT de performance en 2-3 mots ")
                    .append("(ex. « Très bonne journée », « Bonne performance », « Performance correcte », ")
                    .append("« Journée décevante », « Mauvaise journée »), en jugeant le CA réalisé et la ")
                    .append("fréquentation par rapport à la base indiquée. Puis, quand le CA du jour ET la ")
                    .append("référence N-1 sont connus, CHIFFRE l'écart de CA (ex. « +12 % vs même jour ")
                    .append("l'an dernier ») et donne en 1 phrase la raison principale (météo, événement, ")
                    .append("fréquentation) + 1 conseil simple. Ton direct, pas de puces, pas de titre.\n\n");
        }
        p.append("Données du jour : ").append(dayLine(d)).append("\n");
        if (d.caN1Date() == null && d.caN1Equiv() == null) {
            p.append("CA de l'an dernier : NON DISPONIBLE — ne fais aucune comparaison chiffrée de CA, ")
                    .append("ne cite aucun montant pour l'an dernier.\n");
        }
        if (bilan && d.revenue() == null) {
            p.append("CA du jour : NON SAISI — tu ne connais PAS le CA réalisé. N'invente aucun montant et ")
                    .append("n'affirme AUCUN impact ni performance (ni hausse, ni baisse, ni « impact négatif ») ")
                    .append("que les données ne montrent pas — une veille de fête peut être positive comme "
                            + "négative, tu n'en sais rien sans chiffre. Dis simplement que le CA n'a pas été ")
                    .append("saisi ; tu peux au plus rappeler un point pratique sûr (météo, événement), sans ")
                    .append("juger la journée.\n");
        }
        if (detail) {
            p.append("\nLe patron demande de DÉVELOPPER : fais une analyse plus complète, 4 à 6 phrases ")
                    .append("(ou quelques points courts). Explique le POURQUOI (météo, événements, ")
                    .append("fréquentation, écart éventuel vs référence) et détaille les recommandations ")
                    .append("produit par produit. Reste clair et simple, sans jargon. Pour cette fois, ignore ")
                    .append("la consigne de brièveté — mais respecte TOUTES les autres règles, et N'INVENTE ")
                    .append("toujours AUCUN chiffre.\n");
        }
    }

    /** Découpe la réponse batch en analyses par date, sur les marqueurs « ===AAAA-MM-JJ=== ». */
    private Map<String, String> parseBatch(String raw) {
        Map<String, String> out = new java.util.LinkedHashMap<>();
        if (raw == null) {
            return out;
        }
        String currentDate = null;
        StringBuilder buf = new StringBuilder();
        for (String line : raw.split("\\R")) {
            String m = line.strip();
            java.util.regex.Matcher mk = java.util.regex.Pattern
                    .compile("^=+\\s*(\\d{4}-\\d{2}-\\d{2})\\s*=+$").matcher(m);
            if (mk.matches()) {
                if (currentDate != null) {
                    out.put(currentDate, buf.toString().strip());
                }
                currentDate = mk.group(1);
                buf.setLength(0);
            } else if (currentDate != null) {
                buf.append(line).append("\n");
            }
        }
        if (currentDate != null) {
            out.put(currentDate, buf.toString().strip());
        }
        return out;
    }

    // ---- Cache mémoire (TTL) des analyses jour ------------------------------------------------

    /** Signature d'une analyse : tout ce qui change la réponse (établissement, mode, baseline, données). */
    private String cacheKey(String etab, String description, String location, String baseline,
                            String mode, boolean detail, DayContext d) {
        return String.join("",
                nz(etab), nz(description), nz(location), nz(baseline), nz(mode),
                Boolean.toString(detail), String.valueOf(d));
    }

    private String cacheGet(String key) {
        CacheEntry e = cache.get(key);
        if (e == null) {
            return null;
        }
        if (e.expiresAt() < System.currentTimeMillis()) {
            cache.remove(key, e);
            return null;
        }
        return e.value();
    }

    private void cachePut(String key, String value) {
        if (value == null || value.isBlank()) {
            return; // ne pas mémoriser une réponse vide (échec transitoire)
        }
        if (cache.size() >= CACHE_MAX) {
            long now = System.currentTimeMillis();
            cache.values().removeIf(e -> e.expiresAt() < now);
            if (cache.size() >= CACHE_MAX) {
                cache.clear();
            }
        }
        cache.put(key, new CacheEntry(value, System.currentTimeMillis() + CACHE_TTL_MS));
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    /** Avis IA sur le prix de vente d'un article : cohérence, marge, prix psychologique. */
    public PricingResponse pricingAdvice(PricingRequest req) {
        if (!gemini.isConfigured()) {
            return new PricingResponse(false, null, "Analyse IA non configurée sur ce serveur.");
        }
        StringBuilder p = new StringBuilder();
        p.append(header(req.etablissement(), req.location(), req.description()));
        if (notBlank(req.description())) {
            p.append("Type d'établissement (gamme à respecter) : ").append(req.description()).append(".\n");
        }
        p.append(NO_INVENT);
        p.append(STYLE);
        p.append("Article : « ").append(req.articleName()).append(" »");
        if (notBlank(req.articleType())) {
            p.append(" (").append(req.articleType()).append(")");
        }
        p.append(".\n");
        if (notBlank(req.articleDescription())) {
            p.append("Description du produit : ").append(req.articleDescription()).append(".\n");
        }
        if (req.pnetHt() != null) {
            p.append("Coût de revient (PNET) HT : ").append(String.format(java.util.Locale.FRANCE, "%.3f", req.pnetHt())).append(" €.\n");
        }
        if (req.vatRate() != null) {
            p.append("TVA : ").append(Math.round(req.vatRate() * 100)).append(" %.\n");
        }
        if (req.priceTtc() != null) {
            p.append("(Le patron envisage ").append(String.format(java.util.Locale.FRANCE, "%.2f", req.priceTtc()))
                    .append(" € TTC, mais NE reprends PAS ce prix : donne TA recommandation indépendante.)\n");
        }
        p.append("Propose le PRIX DE VENTE TTC que TOI tu recommandes pour CE produit précis — selon sa nature, ")
                .append("sa description, son coût de revient et le marché LOCAL pour CE TYPE D'ÉTABLISSEMENT ")
                .append("— INDÉPENDAMMENT de tout prix déjà saisi. Vise une marge correcte et cohérente avec ce ")
                .append("type de commerce et la nature du produit, ")
                .append("et un prix PSYCHOLOGIQUE arrondi (ex. 2,50 / ")
                .append("3,90 / 6,90 €). COMMENCE impérativement par « Prix conseillé : X,XX € », puis 1 phrase ")
                .append("de justification simple (positionnement, marge). N'invente pas de chiffres de marché précis.\n");
        return new PricingResponse(true, props.gemini().model(), gemini.generate(p.toString()));
    }

    /** Accroches publicitaires courtes pour annoncer une nouveauté. */
    public AdCopyResponse adCopy(AdCopyRequest req) {
        if (!gemini.isConfigured()) {
            return new AdCopyResponse(false, null, List.of());
        }
        StringBuilder p = new StringBuilder();
        p.append(header(req.etablissement(), req.location(), req.description()));
        if (notBlank(req.description())) {
            p.append("Type d'établissement : ").append(req.description()).append(".\n");
        }
        p.append("Rédige des ACCROCHES PUBLICITAIRES pour annoncer une NOUVEAUTÉ : « ")
                .append(req.articleName()).append(" »");
        if (notBlank(req.articleDescription())) {
            p.append(" (").append(req.articleDescription()).append(")");
        }
        if (req.priceTtc() != null) {
            p.append(", au prix de ").append(String.format(java.util.Locale.FRANCE, "%.2f", req.priceTtc())).append(" €");
        }
        p.append(".\nDonne 3 accroches COURTES (60 caractères max chacune), gourmandes et percutantes, en ")
                .append("français, adaptées à ce type d'établissement. Une accroche par ligne, sans numéro, ")
                .append("sans guillemets, 1 emoji maximum par ligne. Rien d'autre que les 3 lignes.\n");
        String raw = gemini.generate(p.toString());
        List<String> slogans = new ArrayList<>();
        if (raw != null) {
            for (String line : raw.split("\\R")) {
                // Retire seulement une puce ou une numérotation en tête (pas les chiffres d'un prix).
                String l = line.replaceFirst("^\\s*(?:[-*•]|\\d+[.)])\\s*", "")
                        .replaceFirst("^[\"«»\\s]+", "")
                        .replaceFirst("[\"«»\\s]+$", "")
                        .trim();
                if (!l.isEmpty()) {
                    slogans.add(l);
                }
            }
        }
        return new AdCopyResponse(true, props.gemini().model(),
                slogans.size() > 3 ? slogans.subList(0, 3) : slogans);
    }

    /** Rédige une publication réseaux sociaux prête à publier à partir d'un brief libre. */
    public SocialPostResponse socialPost(SocialPostRequest req) {
        if (!gemini.isConfigured()) {
            return new SocialPostResponse(false, null, "Génération IA non configurée sur ce serveur.");
        }
        if (!notBlank(req.brief()) && !notBlank(req.articleName())) {
            return new SocialPostResponse(false, null, "Décris un sujet ou choisis un produit.");
        }
        String platform = notBlank(req.platform()) ? req.platform() : "Instagram";
        StringBuilder p = new StringBuilder();
        p.append(header(req.etablissement(), req.location(), req.description()));
        if (notBlank(req.description())) {
            p.append("Type d'établissement : ").append(req.description()).append(".\n");
        }
        p.append("Rédige une PUBLICATION ").append(platform.toUpperCase(java.util.Locale.FRANCE))
                .append(" prête à publier pour cet établissement.\n");
        if (notBlank(req.tone())) {
            p.append("Ton souhaité : ").append(req.tone()).append(".\n");
        }
        if (notBlank(req.articleName())) {
            p.append("La publication met en avant le PRODUIT : « ").append(req.articleName()).append(" »");
            if (notBlank(req.articleDescription())) {
                p.append(" (").append(req.articleDescription()).append(")");
            }
            if (req.priceTtc() != null) {
                p.append(", au prix de ").append(String.format(java.util.Locale.FRANCE, "%.2f", req.priceTtc()))
                        .append(" €");
            }
            p.append(".\n");
        }
        if (notBlank(req.brief())) {
            p.append("Sujet / message : ").append(req.brief()).append(".\n");
        }
        p.append("Consignes : accroche forte dès la 1re ligne ; ").append(lengthRule(req.length()))
                .append(" emojis pertinents avec modération ; un appel à l'action simple si c'est utile ; ")
                .append("puis, sur la DERNIÈRE ligne, ").append(hashtagRule(req.length()))
                .append(" hashtags pertinents (métier + locaux). En français. N'invente aucun chiffre, prix ou ")
                .append("détail non fourni. Rends UNIQUEMENT le texte de la publication, sans titre, sans ")
                .append("guillemets, sans commentaire.\n");
        return new SocialPostResponse(true, props.gemini().model(), gemini.generate(p.toString()));
    }

    /** Consigne de corps de texte selon la longueur demandée (court / moyen / long). */
    private static String lengthRule(String length) {
        String l = length == null ? "" : length.trim().toLowerCase(java.util.Locale.FRANCE);
        return switch (l) {
            case "court" -> "publication TRÈS COURTE : 1 à 2 phrases maximum, percutantes ;";
            case "long" -> "publication DÉVELOPPÉE : 5 à 8 phrases, raconte un peu l'histoire/le contexte ;";
            default -> "publication de longueur MOYENNE : 2 à 4 phrases courtes, chaleureuses et authentiques ;";
        };
    }

    /** Nombre de hashtags selon la longueur (un texte plus long en porte un peu plus). */
    private static String hashtagRule(String length) {
        String l = length == null ? "" : length.trim().toLowerCase(java.util.Locale.FRANCE);
        return switch (l) {
            case "court" -> "3 à 5";
            case "long" -> "8 à 12";
            default -> "5 à 10";
        };
    }

    /** Formate le contexte d'un jour en une ligne lisible pour le prompt. */
    private String dayLine(DayContext d) {
        StringJoiner sj = new StringJoiner(" ; ");
        if (d.revenue() != null) sj.add("CA réalisé du jour : " + Math.round(d.revenue()) + " €");
        if (d.clientCount() != null && d.clientCount() > 0) {
            sj.add("clients : " + d.clientCount());
            if (d.revenue() != null) {
                sj.add("ticket moyen : " + Math.round(d.revenue() / d.clientCount()) + " €");
            }
        }
        if (notBlank(d.events())) sj.add("événements ce jour : " + d.events());
        if (notBlank(d.eventsNext())) sj.add("événement(s) à venir : " + d.eventsNext());
        if (notBlank(d.eventsAr())) sj.add("événements du même jour l'an dernier : " + d.eventsAr());
        if (notBlank(d.eventsAa())) sj.add("événements de la même date l'an dernier : " + d.eventsAa());
        if (notBlank(d.sky()) || d.tMax() != null) {
            sj.add("météo du jour : " + (notBlank(d.sky()) ? d.sky() : "?")
                    + (d.tMax() != null ? ", ~" + Math.round(d.tMax()) + "°C" : ""));
        }
        if (notBlank(d.skyN1()) || d.tMaxN1() != null) {
            sj.add("météo du même jour l'an dernier : " + (notBlank(d.skyN1()) ? d.skyN1() : "?")
                    + (d.tMaxN1() != null ? ", ~" + Math.round(d.tMaxN1()) + "°C" : ""));
        }
        if (notBlank(d.hourly())) sj.add("détail horaire du jour : " + d.hourly());
        if (d.caN1Date() != null) sj.add("CA N-1 (même date) : " + Math.round(d.caN1Date()) + " €");
        if (d.caN1Equiv() != null) sj.add("CA N-1 (jour équiv.) : " + Math.round(d.caN1Equiv()) + " €");
        if (notBlank(d.noteProd())) sj.add("note prod : " + d.noteProd());
        if (notBlank(d.noteSale())) sj.add("note vente : " + d.noteSale());
        if (notBlank(d.noteProdN1())) sj.add("note prod du même jour l'an dernier : " + d.noteProdN1());
        if (notBlank(d.noteSaleN1())) sj.add("note vente du même jour l'an dernier : " + d.noteSaleN1());
        return sj.length() == 0 ? "rien de notable" : sj.toString();
    }

    /** Parse la réponse « AAAA-MM-JJ | conseil » en lignes structurées (sans lib JSON). */
    private List<DayAdvice> parse(String raw) {
        List<DayAdvice> out = new ArrayList<>();
        if (raw == null) {
            return out;
        }
        for (String line : raw.split("\\R")) {
            String l = line.strip().replaceFirst("^[-*•\\s]+", "");
            int bar = l.indexOf('|');
            if (bar < 0) {
                continue;
            }
            String date = l.substring(0, bar).strip();
            String conseil = l.substring(bar + 1).strip();
            if (date.matches("\\d{4}-\\d{2}-\\d{2}") && !conseil.isEmpty()) {
                out.add(new DayAdvice(date, conseil));
            }
        }
        return out;
    }

    /**
     * Base de comparaison + règle anti-biais : ne recommander un écart QUE s'il est justifié par un
     * facteur réel. Si les conditions ressemblent à la référence → « comme d'habitude », sans %.
     */
    private String baselineRule(String baseline) {
        boolean n1 = "n1".equalsIgnoreCase(baseline);
        String base = n1
                ? "l'an dernier — en PRIORITÉ le MÊME JOUR DE LA SEMAINE (« CA N-1 jour équiv. ») ; "
                  + "la « même date » (« CA N-1 même date ») n'est qu'un repère secondaire : "
                  + "si elle tombe un autre jour de semaine, NE l'utilise PAS pour la comparaison principale"
                : "une JOURNÉE HABITUELLE (même jour de semaine, sans particularité)";
        String ex = n1 ? "vs même jour N-1" : "vs un jour normal";
        return "RÉFÉRENCE : compare à " + base + ". "
                + "Ne recommande une HAUSSE ou une BAISSE QUE si un facteur RÉEL la justifie "
                + "(météo nettement différente de la référence, fête, jour férié, pont, événement local). "
                + "Dans ce cas seulement, chiffre l'écart en % et précise la base (ex. « +20% de pain " + ex + " »). "
                + "SINON, si les conditions sont SEMBLABLES à la référence (météo proche, aucun événement), "
                + "conseille simplement de produire COMME D'HABITUDE / comme l'an dernier, SANS pourcentage et "
                + "sans inventer d'écart. Une météo quasi identique ne justifie AUCUNE hausse.\n"
                + "JOURS FÉRIÉS / FÊTES — quand le jour analysé porte une FÊTE ou est FÉRIÉ, la BONNE "
                + "référence est le MÊME jour férié / la MÊME fête l'an dernier : si « événements de la même "
                + "date l'an dernier » porte la même fête, alors « CA N-1 même date » PRIME sur le jour de "
                + "semaine équivalent (un mardi ordinaire n'est PAS comparable à un 14 juillet). Un jour férié "
                + "ne signifie PAS automatiquement plus d'affluence : beaucoup de commerces font MOINS ce "
                + "jour-là (clients partis, habitudes différentes). Fie-toi au CHIFFRE RÉEL de cette fête "
                + "l'an dernier — s'il était FAIBLE, ne recommande PAS d'augmenter, prévois plutôt une "
                + "activité calme. FORMULATION — pour un férié qui fut FAIBLE, dis « produis COMME cette "
                + "fête l'an dernier (≈ montant) » ou « −X % vs un jour NORMAL » ; ne dis JAMAIS « −X % vs "
                + "cette fête l'an dernier » (tu réduirais une 2e fois un jour déjà faible).\n"
                + "PRÉCISE TOUJOURS LA BASE — chaque fois que tu dis d'AUGMENTER ou de RÉDUIRE (production "
                + "ou appro), indique explicitement par rapport à QUOI (ex. « vs un mardi normal » ou « vs "
                + "le 14 juillet l'an dernier »). Sans base précisée, une consigne « augmente » n'a aucun sens.\n"
                + "RÉFÉRENCE ATYPIQUE — si le jour analysé est ORDINAIRE mais que sa référence « même jour "
                + "N-1 » était ELLE-MÊME un jour férié / une fête (voir « événements du même jour l'an "
                + "dernier »), alors ce chiffre N-1 n'est PAS représentatif d'une journée normale : ne t'y "
                + "ancre PAS, écarte-le et raisonne comme pour un jour habituel. De même, une référence à "
                + "0 € (commerce fermé / non saisi) n'est pas exploitable : ignore-la.\n"
                + "RESTE SIMPLE — n'expose PAS ton raisonnement sur les différentes références chiffrées "
                + "(pas de « le CA N-1 de X était… donc… ») : donne DIRECTEMENT la consigne pratique, en "
                + "une base claire au plus.\n";
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
