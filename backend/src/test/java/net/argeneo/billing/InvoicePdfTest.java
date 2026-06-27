package net.argeneo.billing;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import net.argeneo.billing.domain.BillingDocument;
import net.argeneo.billing.domain.BillingDocumentLine;
import net.argeneo.billing.domain.BillingProfile;
import net.argeneo.billing.domain.BillingSettings;
import net.argeneo.billing.domain.Client;
import net.argeneo.billing.domain.ClientKind;
import net.argeneo.billing.domain.DocumentStatus;
import net.argeneo.billing.domain.DocumentType;
import net.argeneo.billing.pdf.DocumentHtmlBuilder;
import net.argeneo.billing.pdf.FacturXService;
import net.argeneo.billing.pdf.HtmlPdfRenderer;
import net.argeneo.iam.domain.Etablissement;
import org.junit.jupiter.api.Test;

/**
 * Test plain (sans Spring) : génère réellement un PDF/A-3 pour un DEVIS et une
 * FACTURE Factur-X. Vérifie l'en-tête %PDF et écrit les fichiers dans build/tmp/.
 */
class InvoicePdfTest {

    private final DocumentHtmlBuilder htmlBuilder = new DocumentHtmlBuilder();
    private final HtmlPdfRenderer renderer = new HtmlPdfRenderer();
    private final FacturXService facturXService = new FacturXService();

    @Test
    void generatesFacturePdfWithFacturX() throws Exception {
        Etablissement etab = etablissement();
        BillingProfile profile = profile();
        BillingSettings settings = settings();
        Client client = client();
        BillingDocument facture = document(DocumentType.FACTURE, "FAC-2026-0001");

        String xhtml = htmlBuilder.build(facture, etab, profile, settings, client, null);
        byte[] visual = renderer.render(xhtml, true);

        assertThat(visual).isNotEmpty();
        assertThat(startsWithPdf(visual)).as("le PDF visuel commence par %PDF").isTrue();
        write("facture-visual.pdf", visual);

        byte[] facturX = facturXService.toFacturX(visual, facture, etab, profile, client);
        assertThat(startsWithPdf(facturX)).as("le PDF Factur-X commence par %PDF").isTrue();
        assertThat(facturX.length)
                .as("le Factur-X (XML embarqué) est plus volumineux que le PDF visuel")
                .isGreaterThan(visual.length);
        write("facture-facturx.pdf", facturX);
    }

    @Test
    void generatesDevisPdf() throws Exception {
        BillingDocument devis = document(DocumentType.DEVIS, "DEV-2026-0001");
        String xhtml = htmlBuilder.build(devis, etablissement(), profile(), settings(), client(), null);
        byte[] pdf = renderer.render(xhtml, true);

        assertThat(startsWithPdf(pdf)).as("le PDF devis commence par %PDF").isTrue();
        write("devis-visual.pdf", pdf);
    }

    // --- fixtures ---

    private BillingDocument document(DocumentType type, String number) {
        BillingDocument doc = new BillingDocument();
        doc.setType(type);
        doc.setNumber(number);
        doc.setStatus(DocumentStatus.EMIS);
        doc.setEtablissementId(1L);
        doc.setClientId(1L);
        doc.setCurrency("EUR");
        doc.setIssueDate(LocalDate.of(2026, 6, 14));
        doc.setDueDate(LocalDate.of(2026, 7, 14));
        doc.setTerms("Paiement à 30 jours par virement.");
        doc.setNotes("Merci de votre confiance & à bientôt <chez nous>.");
        doc.getLines().add(line(1, "Prestation de conseil", new BigDecimal("3"), "h",
                new BigDecimal("120.00"), new BigDecimal("0.20"), new BigDecimal("0.00")));
        doc.getLines().add(line(2, "Fournitures (pain spécial)", new BigDecimal("10"), "u",
                new BigDecimal("2.5000"), new BigDecimal("0.055"), new BigDecimal("0.10")));
        recompute(doc);
        return doc;
    }

    private BillingDocumentLine line(int pos, String designation, BigDecimal qty, String unit,
                                     BigDecimal pu, BigDecimal vat, BigDecimal discount) {
        BillingDocumentLine line = new BillingDocumentLine();
        line.setPosition(pos);
        line.setDesignation(designation);
        line.setQuantity(qty);
        line.setUnit(unit);
        line.setUnitPriceHt(pu);
        line.setVatRate(vat);
        line.setDiscountRate(discount);
        return line;
    }

    private void recompute(BillingDocument doc) {
        BigDecimal totalHt = BigDecimal.ZERO;
        BigDecimal totalVat = BigDecimal.ZERO;
        for (BillingDocumentLine line : doc.getLines()) {
            BigDecimal lineHt = line.getQuantity().multiply(line.getUnitPriceHt())
                    .multiply(BigDecimal.ONE.subtract(line.getDiscountRate()))
                    .setScale(2, RoundingMode.HALF_UP);
            line.setLineTotalHt(lineHt);
            totalHt = totalHt.add(lineHt);
            totalVat = totalVat.add(lineHt.multiply(line.getVatRate()));
        }
        totalHt = totalHt.setScale(2, RoundingMode.HALF_UP);
        totalVat = totalVat.setScale(2, RoundingMode.HALF_UP);
        doc.setTotalHt(totalHt);
        doc.setTotalVat(totalVat);
        doc.setTotalTtc(totalHt.add(totalVat).setScale(2, RoundingMode.HALF_UP));
    }

    private Etablissement etablissement() {
        Etablissement etab = new Etablissement();
        etab.setName("Boulangerie du Coin");
        etab.setAddress("12 rue des Lilas\n75011 Paris");
        return etab;
    }

    private BillingProfile profile() {
        BillingProfile p = new BillingProfile();
        p.setSiren("123456789");
        p.setSiret("12345678900012");
        p.setTvaIntra("FR12123456789");
        p.setRcs("Paris B 123 456 789");
        p.setApe("1071C");
        p.setLegalForm("SARL");
        p.setShareCapital(new BigDecimal("10000.00"));
        p.setIban("FR7630006000011234567890189");
        p.setBic("AGRIFRPP");
        return p;
    }

    private BillingSettings settings() {
        BillingSettings s = new BillingSettings();
        s.setPaymentTermsDays(30);
        s.setLatePenalty("Taux légal majoré + indemnité forfaitaire de 40 €.");
        s.setLegalMentions("TVA non applicable, art. 293 B du CGI le cas échéant.");
        s.setFooter("Boulangerie du Coin — SARL au capital de 10 000 €");
        return s;
    }

    private Client client() {
        Client c = new Client();
        c.setName("Café des Sports");
        c.setKind(ClientKind.PRO);
        c.setSiret("98765432100015");
        c.setTvaIntra("FR98987654321");
        c.setAddress("5 avenue de la Gare");
        c.setPostalCode("75012");
        c.setCity("Paris");
        c.setCountry("France");
        return c;
    }

    private static boolean startsWithPdf(byte[] bytes) {
        return bytes.length >= 4 && bytes[0] == '%' && bytes[1] == 'P'
                && bytes[2] == 'D' && bytes[3] == 'F';
    }

    private static void write(String name, byte[] bytes) throws Exception {
        Path dir = Path.of("build", "tmp");
        Files.createDirectories(dir);
        Files.write(dir.resolve(name), bytes);
    }
}
