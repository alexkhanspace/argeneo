package net.argeneo.billing.pdf;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import net.argeneo.billing.domain.BillingDocument;
import net.argeneo.billing.domain.BillingProfile;
import net.argeneo.billing.domain.BillingSettings;
import net.argeneo.billing.domain.Client;
import net.argeneo.billing.domain.DocumentType;
import net.argeneo.billing.repository.BillingDocumentRepository;
import net.argeneo.billing.repository.BillingProfileRepository;
import net.argeneo.billing.repository.BillingSettingsRepository;
import net.argeneo.billing.repository.ClientRepository;
import net.argeneo.common.error.ResourceNotFoundException;
import net.argeneo.config.ArgeneoProperties;
import net.argeneo.iam.domain.Etablissement;
import net.argeneo.iam.repository.EtablissementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Produit le PDF d'un document de facturation : PDF/A-3 visuel pour les devis,
 * PDF/A-3 + Factur-X (EN16931) pour les factures.
 */
@Service
public class BillingPdfService {

    private final BillingDocumentRepository documentRepository;
    private final ClientRepository clientRepository;
    private final BillingProfileRepository profileRepository;
    private final BillingSettingsRepository settingsRepository;
    private final EtablissementRepository etablissementRepository;
    private final DocumentHtmlBuilder htmlBuilder;
    private final HtmlPdfRenderer renderer;
    private final FacturXService facturXService;
    private final Path uploadDir;

    public BillingPdfService(BillingDocumentRepository documentRepository,
                             ClientRepository clientRepository,
                             BillingProfileRepository profileRepository,
                             BillingSettingsRepository settingsRepository,
                             EtablissementRepository etablissementRepository,
                             DocumentHtmlBuilder htmlBuilder,
                             HtmlPdfRenderer renderer,
                             FacturXService facturXService,
                             ArgeneoProperties properties) {
        this.documentRepository = documentRepository;
        this.clientRepository = clientRepository;
        this.profileRepository = profileRepository;
        this.settingsRepository = settingsRepository;
        this.etablissementRepository = etablissementRepository;
        this.htmlBuilder = htmlBuilder;
        this.renderer = renderer;
        this.facturXService = facturXService;
        this.uploadDir = Path.of(properties.uploads().dir());
    }

    public record Pdf(byte[] bytes, String filename) {
    }

    @Transactional(readOnly = true)
    public Pdf generate(Long id) {
        BillingDocument doc = documentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Document introuvable : " + id));
        Client client = clientRepository.findById(doc.getClientId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Client introuvable : " + doc.getClientId()));
        Etablissement etab = etablissementRepository.findById(doc.getEtablissementId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Établissement introuvable : " + doc.getEtablissementId()));
        BillingProfile profile = profileRepository
                .findByEtablissementId(doc.getEtablissementId()).orElse(null);
        BillingSettings settings = settingsRepository
                .findByEtablissementId(doc.getEtablissementId()).orElse(null);
        byte[] logoBytes = readLogo(profile);

        String xhtml = htmlBuilder.build(doc, etab, profile, settings, client, logoBytes);
        byte[] pdf = renderer.render(xhtml, true);
        if (doc.getType() == DocumentType.FACTURE) {
            pdf = facturXService.toFacturX(pdf, doc, etab, profile, client);
        }

        String suffix = doc.getNumber() != null ? doc.getNumber() : String.valueOf(doc.getId());
        String filename = doc.getType().name().toLowerCase() + "-" + suffix + ".pdf";
        return new Pdf(pdf, filename);
    }

    private byte[] readLogo(BillingProfile profile) {
        if (profile == null || profile.getLogoFile() == null || profile.getLogoFile().isBlank()) {
            return null;
        }
        Path path = uploadDir.resolve(profile.getLogoFile()).normalize();
        if (!path.startsWith(uploadDir.normalize()) || !Files.isRegularFile(path)) {
            return null;
        }
        try {
            return Files.readAllBytes(path);
        } catch (IOException e) {
            return null;
        }
    }
}
