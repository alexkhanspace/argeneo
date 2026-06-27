package net.argeneo.billing.pdf;

import com.openhtmltopdf.outputdevice.helper.BaseRendererBuilder.FontStyle;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import java.awt.color.ColorSpace;
import java.awt.color.ICC_Profile;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import org.springframework.stereotype.Component;

/**
 * Rend un XHTML (bien formé) en PDF via openhtmltopdf. Quand {@code pdfA} est vrai,
 * produit un PDF/A-3 (conformance requise pour embarquer le XML Factur-X).
 * Les polices DejaVu Sans (normal + gras) sont embarquées.
 */
@Component
public class HtmlPdfRenderer {

    public byte[] render(String xhtml, boolean pdfA) {
        try (ByteArrayOutputStream os = new ByteArrayOutputStream()) {
            PdfRendererBuilder b = new PdfRendererBuilder();
            b.useFastMode();
            b.useFont(() -> font("/fonts/DejaVuSans.ttf"), "DejaVu Sans", 400, FontStyle.NORMAL, true);
            b.useFont(() -> font("/fonts/DejaVuSans-Bold.ttf"), "DejaVu Sans", 700, FontStyle.NORMAL, true);
            if (pdfA) {
                b.usePdfAConformance(PdfRendererBuilder.PdfAConformance.PDFA_3_U);
                b.useColorProfile(ICC_Profile.getInstance(ColorSpace.CS_sRGB).getData());
            }
            b.withHtmlContent(xhtml, null);
            b.toStream(os);
            b.run();
            return os.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Échec du rendu PDF du document de facturation", e);
        }
    }

    private InputStream font(String path) {
        InputStream in = getClass().getResourceAsStream(path);
        if (in == null) {
            throw new IllegalStateException("Police introuvable dans le classpath : " + path);
        }
        return in;
    }
}
