import { Document, Image, Page, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 0 },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
})

/**
 * Enveloppe le visuel composé (PNG en data URL) dans un PDF d'une page au format A4 ou A5,
 * prêt à imprimer. Le visuel du canevas respecte déjà le ratio √2, il couvre donc la page.
 */
export async function buildPosterPdfBlob(pngDataUrl: string, size: 'A4' | 'A5'): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer')
  return pdf(
    <Document>
      <Page size={size} style={styles.page}>
        <Image src={pngDataUrl} style={styles.img} />
      </Page>
    </Document>,
  ).toBlob()
}
