package net.argeneo.billing.pdf;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import net.argeneo.billing.domain.BillingDocument;
import net.argeneo.billing.domain.BillingDocumentLine;
import net.argeneo.billing.domain.BillingProfile;
import net.argeneo.billing.domain.Client;
import net.argeneo.iam.domain.Etablissement;
import org.mustangproject.Invoice;
import org.mustangproject.Item;
import org.mustangproject.Product;
import org.mustangproject.TradeParty;
import org.mustangproject.ZUGFeRD.Profiles;
import org.mustangproject.ZUGFeRD.ZUGFeRDExporterFromA3;
import org.springframework.stereotype.Component;

/**
 * Embarque le XML Factur-X (profil EN16931) dans un PDF/A-3 existant à l'aide de
 * Mustang. Mustang recalcule les totaux à partir des lignes ; les valeurs du
 * document servent uniquement de garde-fou.
 */
@Component
public class FacturXService {

    private static final String DEFAULT_UNIT = "C62"; // UN/ECE : "pièce" / unité.

    public byte[] toFacturX(byte[] pdfA3, BillingDocument doc, Etablissement etab,
                            BillingProfile profile, Client client) {
        Invoice invoice = new Invoice()
                .setNumber(value(doc.getNumber(), "DRAFT"))
                .setIssueDate(toDate(doc.getIssueDate()))
                .setDeliveryDate(toDate(doc.getIssueDate()))
                .setDueDate(toDate(doc.getDueDate() != null ? doc.getDueDate() : doc.getIssueDate()))
                .setCurrency(value(doc.getCurrency(), "EUR"))
                .setSender(sender(etab, profile))
                .setRecipient(recipient(client));

        for (BillingDocumentLine line : doc.getLines()) {
            BigDecimal vatPercent = nz(line.getVatRate()).multiply(BigDecimal.valueOf(100));
            String unitCode = value(line.getUnit(), DEFAULT_UNIT);
            Product product = new Product(
                    value(line.getDesignation(), "—"), "", unitCode, vatPercent);
            Item item = new Item(product, nz(line.getUnitPriceHt()), nz(line.getQuantity()));
            invoice.addItem(item);
        }

        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            ZUGFeRDExporterFromA3 exporter = new ZUGFeRDExporterFromA3()
                    .load(pdfA3)
                    .setProducer("Argeneo")
                    .setCreator("Argeneo")
                    .setProfile(Profiles.getByName("EN16931"));
            exporter.setTransaction(invoice);
            exporter.export(os);
            return os.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Échec de l'embarquement Factur-X", e);
        }
    }

    private TradeParty sender(Etablissement etab, BillingProfile profile) {
        String[] addr = splitAddress(etab != null ? etab.getAddress() : null);
        TradeParty sender = new TradeParty(
                etab != null ? value(etab.getName(), "Émetteur") : "Émetteur",
                addr[0], addr[1], addr[2], "FR");
        if (profile != null) {
            if (notBlank(profile.getTvaIntra())) {
                sender.addVATID(profile.getTvaIntra());
            }
            if (notBlank(profile.getSiret())) {
                sender.addTaxID(profile.getSiret());
            }
        }
        return sender;
    }

    private TradeParty recipient(Client client) {
        TradeParty recipient = new TradeParty(
                value(client.getName(), "Client"),
                value(client.getAddress(), ""),
                value(client.getPostalCode(), ""),
                value(client.getCity(), ""),
                countryCode(client.getCountry()));
        if (notBlank(client.getTvaIntra())) {
            recipient.addVATID(client.getTvaIntra());
        }
        if (notBlank(client.getSiret())) {
            recipient.addTaxID(client.getSiret());
        }
        return recipient;
    }

    /** Découpe l'adresse multi-lignes de l'établissement en [rue, codePostal, ville]. */
    private static String[] splitAddress(String address) {
        String[] result = {"", "", ""};
        if (!notBlank(address)) {
            return result;
        }
        String[] lines = address.split("\\r?\\n");
        result[0] = lines[0].trim();
        if (lines.length > 1) {
            String last = lines[lines.length - 1].trim();
            String[] cp = last.split("\\s+", 2);
            if (cp.length == 2 && cp[0].matches("\\d{4,5}")) {
                result[1] = cp[0];
                result[2] = cp[1];
            } else {
                result[2] = last;
            }
        }
        return result;
    }

    private static String countryCode(String country) {
        if (country != null && country.trim().equalsIgnoreCase("France")) {
            return "FR";
        }
        return notBlank(country) ? country.trim() : "FR";
    }

    private static Date toDate(LocalDate date) {
        LocalDate d = date != null ? date : LocalDate.now();
        return Date.from(d.atStartOfDay(ZoneId.systemDefault()).toInstant());
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String value(String s, String fallback) {
        return notBlank(s) ? s : fallback;
    }
}
