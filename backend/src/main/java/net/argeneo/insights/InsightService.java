package net.argeneo.insights;

import java.util.ArrayList;
import java.util.List;
import java.util.StringJoiner;
import net.argeneo.config.ArgeneoProperties;
import net.argeneo.insights.api.dto.InsightDtos.DayAdvice;
import net.argeneo.insights.api.dto.InsightDtos.DayAnalysisRequest;
import net.argeneo.insights.api.dto.InsightDtos.DayAnalysisResponse;
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

    /** Repères métier boulangerie, injectés dans les prompts pour des conseils pertinents. */
    private static final String METIER =
            "Repères métier boulangerie (utilise-les quand c'est pertinent, et SEULEMENT si le contexte du "
            + "jour s'y prête) : l'effet « barbecue / pique-nique → PLUS DE PAIN et baguettes » ne vaut "
            + "QUE par beau temps (ciel dégagé ou peu nuageux) ET un WEEK-END, jour férié ou pont — "
            + "PAS un jour de semaine ordinaire, et PAS s'il pleut (averses, bruine, orage) ; "
            + "forte chaleur/canicule → boissons fraîches en hausse, pâtisseries fragiles "
            + "(crème, chocolat, glaçage) en baisse, le pain restant demandé si beau week-end ; "
            + "PLUIE, averses ou froid → viennoiseries et produits réconfortants, pas de barbecue ; "
            + "fêtes et jours fériés → forte affluence et produits de tradition.\n";

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

    /** Style : court et simple, comme on parle à un boulanger pressé (pas de blabla). */
    private static final String STYLE =
            "STYLE — Parle SIMPLEMENT et BRIÈVEMENT, comme à un boulanger pressé : phrases courtes, "
            + "mots courants, AUCUN jargon, pas d'introduction ni de conclusion, droit au but.\n";

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

    /** En-tête commun : rôle + localisation réelle de l'établissement (plus de ville codée en dur). */
    private String header(String etablissement, String location) {
        StringBuilder h = new StringBuilder();
        h.append("Tu es un conseiller pour la boulangerie « ").append(etablissement).append(" »");
        if (notBlank(location)) {
            h.append(" située à ").append(location)
                    .append(" (tiens compte du climat, des habitudes et des événements locaux de ce secteur)");
        }
        h.append(".\n");
        return h.toString();
    }

    private String buildPrompt(TrendRequest req) {
        StringBuilder p = new StringBuilder();
        p.append(header(req.etablissement(), req.location()));
        if (notBlank(req.description())) {
            p.append("TYPE D'ÉTABLISSEMENT (à respecter STRICTEMENT) : ").append(req.description()).append(".\n")
                    .append("Ne propose QUE des produits cohérents avec ce type d'établissement et sa gamme. ")
                    .append("N'invente pas de produits hors gamme (ex. ne propose pas de pâtisseries orientales ")
                    .append("pour une boulangerie traditionnelle française).\n");
        }
        p.append(METIER);
        p.append(NO_INVENT);
        p.append(EVENTS_NOTE);
        p.append(STYLE);
        p.append(baselineRule(req.baseline()));
        p.append("Analyse les jours ci-dessous et donne un conseil de PRODUCTION / APPROVISIONNEMENT ")
                .append("UNIQUEMENT pour les jours à enjeu (fête, météo marquante, écart de CA vs an dernier).\n\n")
                .append("FORMAT DE RÉPONSE STRICT : une ligne par jour notable, exactement\n")
                .append("AAAA-MM-JJ | conseil court et actionnable\n")
                .append("(ex. « 2026-06-21 | Fête de la Musique + chaleur : +20 % viennoiseries et boissons fraîches »).\n")
                .append("Un conseil de 120 caractères max, concret et chiffré si possible. ")
                .append("N'inclus PAS les jours sans enjeu. Aucune autre ligne, pas d'introduction ni de puces.\n\n")
                .append("Données :\n");

        for (DayContext d : req.days()) {
            p.append("- ").append(d.date());
            if (notBlank(d.weekday())) p.append(" (").append(d.weekday()).append(")");
            p.append(" : ").append(dayLine(d)).append("\n");
        }
        return p.toString();
    }

    /** Analyse d'UNE journée (tableau de bord) — répond toujours. */
    public DayAnalysisResponse dayAnalysis(DayAnalysisRequest req) {
        if (!gemini.isConfigured()) {
            return new DayAnalysisResponse(false, null, "Analyse IA non configurée sur ce serveur.");
        }
        DayContext d = req.day();
        String mode = req.mode() == null ? "" : req.mode();
        boolean bilan = "bilan".equalsIgnoreCase(mode);
        boolean prep = "prep".equalsIgnoreCase(mode);
        StringBuilder p = new StringBuilder();
        p.append(header(req.etablissement(), req.location()));
        if (notBlank(req.description())) {
            p.append("Type d'établissement (à respecter STRICTEMENT, aucun produit hors gamme) : ")
                    .append(req.description()).append(".\n");
        }
        p.append(METIER);
        p.append(NO_INVENT);
        p.append(EVENTS_NOTE);
        p.append(STYLE);
        p.append(baselineRule(req.baseline()));
        if (prep) {
            // J+1 : que PRÉPARER pour demain (orienté production/appro).
            p.append("Demain, le ").append(d.date());
            if (notBlank(d.weekday())) {
                p.append(" (").append(d.weekday()).append(")");
            }
            p.append(". Dis au patron CE QU'IL DOIT PRÉPARER POUR DEMAIN pour la production et ")
                    .append("l'approvisionnement : quoi produire en plus ou en moins, quoi commander, ")
                    .append("selon les événements de demain, la météo prévue et le CA de l'an dernier ")
                    .append("(simple référence de fréquentation). NE FAIS PAS d'analyse du chiffre d'affaires. ")
                    .append("Reste strictement dans la gamme. 1 à 2 phrases COURTES, ton direct et ")
                    .append("impératif, concret, pas de puces, pas de titre.\n\n");
        } else if (!bilan) {
            // J : que FAIRE aujourd'hui (orienté production/appro), PAS d'analyse de CA.
            p.append("Nous sommes le ").append(d.date());
            if (notBlank(d.weekday())) {
                p.append(" (").append(d.weekday()).append(")");
            }
            p.append(". Dis au patron CE QU'IL DOIT FAIRE AUJOURD'HUI pour la production et ")
                    .append("l'approvisionnement : quoi produire en plus ou en moins, quoi commander, ")
                    .append("en te basant sur les événements du jour, la météo, et le CA de l'an dernier ")
                    .append("(simple référence de fréquentation). NE FAIS PAS d'analyse du chiffre d'affaires. ")
                    .append("Reste strictement dans la gamme. 1 à 2 phrases COURTES, ton direct et ")
                    .append("impératif, concret, pas de puces, pas de titre.\n\n");
        } else {
            // J-1/J-2 : journée FINIE -> bilan ANALYTIQUE avec verdict de performance.
            p.append("La journée ").append(d.date());
            if (notBlank(d.weekday())) {
                p.append(" (").append(d.weekday()).append(")");
            }
            p.append(" est TERMINÉE : fais-en l'ANALYSE pour le patron. ")
                    .append("COMMENCE par un VERDICT de performance en 2-3 mots ")
                    .append("(ex. « Très bonne journée », « Bonne performance », « Performance correcte », ")
                    .append("« Journée décevante », « Mauvaise journée »), en jugeant le CA réalisé et la ")
                    .append("fréquentation par rapport à la base indiquée. Puis 1 phrase COURTE : ")
                    .append("la raison principale + 1 conseil simple. Ton direct, pas de puces, pas de titre.\n\n");
        }
        p.append("Données du jour : ").append(dayLine(d)).append("\n");
        if (d.caN1Date() == null && d.caN1Equiv() == null) {
            p.append("CA de l'an dernier : NON DISPONIBLE — ne fais aucune comparaison chiffrée de CA, ")
                    .append("ne cite aucun montant pour l'an dernier.\n");
        }
        if (bilan && d.revenue() == null) {
            p.append("CA du jour : NON SAISI — tu ne connais pas le CA réalisé : n'invente pas de montant, ")
                    .append("indique simplement que le CA n'a pas été saisi et appuie-toi sur le contexte.\n");
        }
        if (Boolean.TRUE.equals(req.detail())) {
            p.append("\nLe patron demande de DÉVELOPPER : fais une analyse plus complète, 4 à 6 phrases ")
                    .append("(ou quelques points courts). Explique le POURQUOI (météo, événements, ")
                    .append("fréquentation, écart éventuel vs référence) et détaille les recommandations ")
                    .append("produit par produit. Reste clair et simple, sans jargon. Pour cette fois, ignore ")
                    .append("la consigne de brièveté — mais respecte TOUTES les autres règles, et N'INVENTE ")
                    .append("toujours AUCUN chiffre.\n");
        }
        return new DayAnalysisResponse(true, props.gemini().model(), gemini.generate(p.toString()));
    }

    /** Avis IA sur le prix de vente d'un article : cohérence, marge, prix psychologique. */
    public PricingResponse pricingAdvice(PricingRequest req) {
        if (!gemini.isConfigured()) {
            return new PricingResponse(false, null, "Analyse IA non configurée sur ce serveur.");
        }
        StringBuilder p = new StringBuilder();
        p.append(header(req.etablissement(), req.location()));
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
                .append("sa description, son coût de revient et le marché d'une boulangerie-pâtisserie de ce ")
                .append("secteur — INDÉPENDAMMENT de tout prix déjà saisi. Vise une marge boulangerie correcte ")
                .append("(coefficient ~2,5 à 3,5 sur le coût HT) et un prix PSYCHOLOGIQUE arrondi (ex. 2,50 / ")
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
        p.append(header(req.etablissement(), req.location()));
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
                .append("français, adaptées à une boulangerie-pâtisserie. Une accroche par ligne, sans numéro, ")
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
        p.append(header(req.etablissement(), req.location()));
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
                + "sans inventer d'écart. Une météo quasi identique ne justifie AUCUNE hausse.\n";
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
