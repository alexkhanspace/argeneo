package net.argeneo.billing.pdf;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Locale;
import net.argeneo.billing.domain.BillingDocument;
import net.argeneo.billing.domain.BillingDocumentLine;
import net.argeneo.billing.domain.BillingProfile;
import net.argeneo.billing.domain.BillingSettings;
import net.argeneo.billing.domain.Client;
import net.argeneo.billing.domain.DocumentType;
import net.argeneo.iam.domain.Etablissement;
import org.springframework.stereotype.Component;

/**
 * Construit le XHTML (XML bien formé) d'un devis ou d'une facture française :
 * en-tête + logo, blocs émetteur / client, tableau des lignes, récapitulatif
 * HT / TVA / TTC, conditions, mentions légales, coordonnées bancaires.
 */
@Component
public class DocumentHtmlBuilder {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Locale FR = Locale.FRANCE;
    private static final String ACCENT = "#b5651d";

    public String build(BillingDocument doc, Etablissement etab, BillingProfile profile,
                        BillingSettings settings, Client client, byte[] logoBytes) {
        boolean facture = doc.getType() == DocumentType.FACTURE;
        String title = facture ? "FACTURE" : "DEVIS";

        // Couleurs de marque (3 max), avec replis en cascade vers l'ocre par défaut.
        String c1 = settings != null ? safeColor(settings.getBrandColor1(), ACCENT) : ACCENT;
        String c2 = settings != null ? safeColor(settings.getBrandColor2(), c1) : c1;
        String c3 = settings != null ? safeColor(settings.getBrandColor3(), c2) : c2;

        StringBuilder sb = new StringBuilder(4096);
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<html xmlns=\"http://www.w3.org/1999/xhtml\"><head>");
        sb.append("<meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\"/>");
        sb.append("<style>").append(css(c1, c2, c3)).append("</style>");
        sb.append("</head><body>");

        // En-tête
        sb.append("<div class=\"header\">");
        sb.append("<div class=\"brand\">");
        if (logoBytes != null && logoBytes.length > 0) {
            sb.append("<img class=\"logo\" src=\"data:")
              .append(mime(logoBytes)).append(";base64,")
              .append(Base64.getEncoder().encodeToString(logoBytes))
              .append("\" alt=\"logo\"/>");
        }
        sb.append("<div class=\"emitter-name\">").append(esc(value(etab.getName()))).append("</div>");
        sb.append("</div>");
        sb.append("<div class=\"doc-head\">");
        sb.append("<div class=\"doc-title\">").append(title).append("</div>");
        if (doc.getNumber() != null) {
            sb.append("<div class=\"doc-number\">N° ").append(esc(doc.getNumber())).append("</div>");
        }
        sb.append("<table class=\"dates\">");
        sb.append(dateRow("Date d'émission", doc.getIssueDate()));
        if (doc.getDueDate() != null) {
            sb.append(dateRow(facture ? "Échéance" : "Validité", doc.getDueDate()));
        }
        sb.append("</table>");
        sb.append("</div>");
        sb.append("</div>");

        // Blocs émetteur / client
        sb.append("<div class=\"parties\">");
        sb.append("<div class=\"party\"><div class=\"party-label\">Émetteur</div>");
        sb.append("<div class=\"party-name\">").append(esc(value(etab.getName()))).append("</div>");
        sb.append(addr(etab.getAddress()));
        if (profile != null) {
            // Les identifiants légaux (SIREN/SIRET/RCS/APE/TVA/forme/capital) sont en pied de page.
            sb.append(field("Tél", profile.getContactPhone()));
            sb.append(field("Email", profile.getContactEmail()));
        }
        sb.append("</div>");

        sb.append("<div class=\"party\"><div class=\"party-label\">Client</div>");
        sb.append("<div class=\"party-name\">").append(esc(value(client.getName()))).append("</div>");
        sb.append(addr(client.getAddress()));
        String cityLine = join(client.getPostalCode(), client.getCity());
        if (!cityLine.isBlank()) {
            sb.append("<div class=\"party-line\">").append(esc(cityLine)).append("</div>");
        }
        if (client.getCountry() != null && !client.getCountry().isBlank()) {
            sb.append("<div class=\"party-line\">").append(esc(client.getCountry())).append("</div>");
        }
        sb.append(field("SIRET", client.getSiret()));
        sb.append(field("N° TVA", client.getTvaIntra()));
        sb.append("</div>");
        sb.append("</div>");

        // Tableau des lignes
        sb.append("<table class=\"lines\">");
        sb.append("<colgroup>")
          .append("<col style=\"width:32%\"/><col style=\"width:9%\"/><col style=\"width:9%\"/>")
          .append("<col style=\"width:14%\"/><col style=\"width:11%\"/><col style=\"width:11%\"/>")
          .append("<col style=\"width:14%\"/>")
          .append("</colgroup>");
        sb.append("<thead><tr>");
        sb.append("<th class=\"l\">Désignation</th><th class=\"r\">Qté</th><th class=\"c\">Unité</th>")
          .append("<th class=\"r\">PU HT</th><th class=\"r\">TVA %</th><th class=\"r\">Remise %</th>")
          .append("<th class=\"r\">Total HT</th>");
        sb.append("</tr></thead><tbody>");
        for (BillingDocumentLine line : doc.getLines()) {
            sb.append("<tr>");
            sb.append("<td class=\"l\">").append(esc(value(line.getDesignation()))).append("</td>");
            sb.append("<td class=\"r\">").append(esc(qty(line.getQuantity()))).append("</td>");
            sb.append("<td class=\"c\">").append(esc(value(line.getUnit()))).append("</td>");
            sb.append("<td class=\"r\">").append(euro(line.getUnitPriceHt())).append("</td>");
            sb.append("<td class=\"r\">").append(esc(pct(line.getVatRate()))).append("</td>");
            sb.append("<td class=\"r\">").append(esc(pct(line.getDiscountRate()))).append("</td>");
            sb.append("<td class=\"r\">").append(euro(line.getLineTotalHt())).append("</td>");
            sb.append("</tr>");
        }
        sb.append("</tbody></table>");

        // Récapitulatif
        sb.append("<table class=\"totals\">");
        sb.append(totalRow("Total HT", euro(doc.getTotalHt()), false));
        sb.append(totalRow("TVA", euro(doc.getTotalVat()), false));
        sb.append(totalRow("Total TTC", euro(doc.getTotalTtc()), true));
        sb.append("</table>");

        // Conditions / notes / mentions
        if (notBlank(doc.getTerms())) {
            sb.append(block("Conditions", doc.getTerms()));
        }
        if (notBlank(doc.getNotes())) {
            sb.append(block("Notes", doc.getNotes()));
        }
        if (settings != null) {
            if (settings.getPaymentTermsDays() != null) {
                sb.append("<div class=\"mention\">Délai de paiement : ")
                  .append(settings.getPaymentTermsDays()).append(" jours.</div>");
            }
            if (notBlank(settings.getLatePenalty())) {
                sb.append("<div class=\"mention\">Pénalités de retard : ")
                  .append(esc(settings.getLatePenalty())).append("</div>");
            }
            if (notBlank(settings.getLegalMentions())) {
                sb.append("<div class=\"mention\">").append(esc(settings.getLegalMentions())).append("</div>");
            }
        }
        if (profile != null && (notBlank(profile.getIban()) || notBlank(profile.getBic()))) {
            sb.append("<div class=\"bank\">");
            if (notBlank(profile.getIban())) {
                sb.append("<span>IBAN : ").append(esc(profile.getIban())).append("</span> ");
            }
            if (notBlank(profile.getBic())) {
                sb.append("<span>BIC : ").append(esc(profile.getBic())).append("</span>");
            }
            sb.append("</div>");
        }
        String legal = legalLine(profile);
        boolean hasFooter = settings != null && notBlank(settings.getFooter());
        if (notBlank(legal) || hasFooter) {
            sb.append("<div class=\"footer\">");
            if (notBlank(legal)) {
                sb.append("<div class=\"legal\">").append(esc(legal)).append("</div>");
            }
            if (hasFooter) {
                sb.append("<div>").append(esc(settings.getFooter())).append("</div>");
            }
            sb.append("</div>");
        }

        sb.append("</body></html>");
        return sb.toString();
    }

    private String dateRow(String label, LocalDate date) {
        return "<tr><td class=\"dl\">" + esc(label) + "</td><td>"
                + (date != null ? date.format(DATE) : "—") + "</td></tr>";
    }

    private String totalRow(String label, String amount, boolean strong) {
        String cls = strong ? " class=\"grand\"" : "";
        return "<tr" + cls + "><td class=\"tl\">" + esc(label) + "</td><td class=\"tv\">" + amount + "</td></tr>";
    }

    private String field(String label, String value) {
        if (!notBlank(value)) {
            return "";
        }
        return "<div class=\"party-field\"><span class=\"fl\">" + esc(label) + " :</span> "
                + esc(value) + "</div>";
    }

    private String addr(String address) {
        if (!notBlank(address)) {
            return "";
        }
        StringBuilder out = new StringBuilder();
        for (String part : address.split("\\r?\\n")) {
            if (notBlank(part)) {
                out.append("<div class=\"party-line\">").append(esc(part.trim())).append("</div>");
            }
        }
        return out.toString();
    }

    private String block(String label, String text) {
        return "<div class=\"section\"><div class=\"section-label\">" + esc(label)
                + "</div><div class=\"section-body\">" + esc(text) + "</div></div>";
    }

    private static String join(String a, String b) {
        String left = a == null ? "" : a.trim();
        String right = b == null ? "" : b.trim();
        return (left + " " + right).trim();
    }

    private static String value(String s) {
        return s == null ? "" : s;
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String euro(BigDecimal amount) {
        return esc(euroRaw(amount));
    }

    /** Montant en euros sans échappement HTML (pour composer une ligne échappée ensuite). */
    private static String euroRaw(BigDecimal amount) {
        BigDecimal v = amount == null ? BigDecimal.ZERO : amount;
        return String.format(FR, "%,.2f €", v);
    }

    /**
     * Ligne de mentions légales générée depuis le profil émetteur, à afficher en pied de page :
     * "SARL au capital de 10 000,00 € — SIREN … — SIRET … — RCS … — APE … — TVA …".
     * Renvoie une chaîne brute (non échappée) ; l'appelant l'échappe.
     */
    private static String legalLine(BillingProfile p) {
        if (p == null) {
            return "";
        }
        StringBuilder line = new StringBuilder();
        String form = notBlank(p.getLegalForm()) ? p.getLegalForm().trim() : null;
        if (form != null && p.getShareCapital() != null) {
            append(line, form + " au capital de " + euroRaw(p.getShareCapital()));
        } else if (form != null) {
            append(line, form);
        } else if (p.getShareCapital() != null) {
            append(line, "Capital " + euroRaw(p.getShareCapital()));
        }
        if (notBlank(p.getSiren())) {
            append(line, "SIREN " + p.getSiren().trim());
        }
        if (notBlank(p.getSiret())) {
            append(line, "SIRET " + p.getSiret().trim());
        }
        if (notBlank(p.getRcs())) {
            append(line, "RCS " + p.getRcs().trim());
        }
        if (notBlank(p.getApe())) {
            append(line, "APE " + p.getApe().trim());
        }
        if (notBlank(p.getTvaIntra())) {
            append(line, "TVA " + p.getTvaIntra().trim());
        }
        return line.toString();
    }

    private static void append(StringBuilder line, String part) {
        if (line.length() > 0) {
            line.append(" — ");
        }
        line.append(part);
    }

    private static String qty(BigDecimal q) {
        if (q == null) {
            return "";
        }
        BigDecimal stripped = q.stripTrailingZeros();
        if (stripped.scale() <= 0) {
            return String.format(FR, "%,d", stripped.toBigInteger());
        }
        return String.format(FR, "%,.3f", stripped);
    }

    private static String pct(BigDecimal fraction) {
        if (fraction == null || fraction.signum() == 0) {
            return "0";
        }
        BigDecimal p = fraction.multiply(BigDecimal.valueOf(100)).stripTrailingZeros();
        return p.toPlainString();
    }

    private static String mime(byte[] bytes) {
        if (bytes.length >= 8 && (bytes[0] & 0xFF) == 0x89 && bytes[1] == 'P'
                && bytes[2] == 'N' && bytes[3] == 'G') {
            return "image/png";
        }
        if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8) {
            return "image/jpeg";
        }
        if (bytes.length >= 6 && bytes[0] == 'G' && bytes[1] == 'I' && bytes[2] == 'F') {
            return "image/gif";
        }
        return "image/png";
    }

    /** Échappe le HTML/XML des champs texte saisis. */
    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }

    /** Couleur hex validée (anti-injection CSS) ou repli. */
    private static String safeColor(String c, String fallback) {
        return c != null && c.matches("#[0-9a-fA-F]{3,8}") ? c : fallback;
    }

    private static String css(String c1, String c2, String c3) {
        return "@page{size:A4;margin:1.6cm;}"
                + "*{box-sizing:border-box;}"
                + "body{font-family:'DejaVu Sans',sans-serif;font-size:10pt;color:#222;line-height:1.4;}"
                + ".header{display:block;border-bottom:2px solid " + c1 + ";padding-bottom:10px;margin-bottom:16px;}"
                + ".brand{display:inline-block;width:55%;vertical-align:top;}"
                + ".logo{max-height:70px;max-width:200px;display:block;margin-bottom:6px;}"
                + ".emitter-name{font-weight:bold;font-size:14pt;color:" + c1 + ";}"
                + ".doc-head{display:inline-block;width:44%;text-align:right;vertical-align:top;}"
                + ".doc-title{font-weight:bold;font-size:22pt;color:" + c2 + ";letter-spacing:2px;}"
                + ".doc-number{font-weight:bold;font-size:11pt;margin-top:2px;color:" + c2 + ";}"
                + ".dates{margin-left:auto;margin-top:6px;border-collapse:collapse;font-size:9pt;}"
                + ".dates td{padding:1px 4px;text-align:right;}"
                + ".dates .dl{color:#666;}"
                + ".parties{margin-bottom:16px;}"
                + ".party{display:inline-block;width:48%;vertical-align:top;border:1px solid #ddd;"
                + "border-radius:4px;padding:8px 10px;}"
                + ".parties .party:first-child{margin-right:2%;}"
                + ".party-label{font-size:8pt;text-transform:uppercase;color:" + c2 + ";font-weight:bold;"
                + "letter-spacing:1px;margin-bottom:3px;}"
                + ".party-name{font-weight:bold;font-size:11pt;}"
                + ".party-line{font-size:9pt;color:#444;}"
                + ".party-field{font-size:8.5pt;color:#555;}"
                + ".party-field .fl{color:#888;}"
                + "table.lines{width:100%;table-layout:fixed;border-collapse:collapse;margin-bottom:14px;font-size:9.5pt;}"
                + "table.lines th{background:" + c1 + ";color:#fff;padding:6px 8px;font-weight:bold;}"
                + "table.lines td{padding:5px 8px;border-bottom:1px solid #eee;vertical-align:top;}"
                + "table.lines tbody tr:nth-child(even){background:#f7f7f7;}"
                // En-têtes alignés comme les valeurs (sinon th centré écrase .r).
                + "table.lines th.l,table.lines td.l{text-align:left;word-break:break-word;}"
                + "table.lines th.r,table.lines td.r{text-align:right;white-space:nowrap;}"
                + "table.lines th.c,table.lines td.c{text-align:center;}"
                + "table.totals{margin-left:auto;border-collapse:collapse;width:42%;margin-bottom:16px;}"
                + "table.totals td{padding:5px 10px;}"
                + "table.totals .tl{text-align:left;color:#555;}"
                + "table.totals .tv{text-align:right;font-weight:bold;}"
                + "table.totals .grand td{background:" + c1 + ";color:#fff;font-size:12pt;}"
                + ".section{margin-bottom:10px;}"
                + ".section-label{font-weight:bold;color:" + c3 + ";font-size:9pt;margin-bottom:2px;}"
                + ".section-body{font-size:9pt;color:#444;white-space:pre-wrap;}"
                + ".mention{font-size:8pt;color:#666;margin-top:4px;}"
                + ".bank{font-size:9pt;color:#333;margin-top:10px;padding:6px 8px;background:#f7f7f7;"
                + "border:1px solid #e2e2e2;border-radius:4px;}"
                + ".footer{margin-top:18px;padding-top:8px;border-top:1px solid #ddd;font-size:8pt;"
                + "color:#888;text-align:center;}"
                + ".footer .legal{color:#666;line-height:1.5;}"
                + ".footer div+div{margin-top:3px;}";
    }
}
