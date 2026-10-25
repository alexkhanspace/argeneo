import { getProfile, logoUrl } from '../api/billing'
import { toDataUrl } from './buildRecipePdf'
import type { PoPdfData } from './PurchaseOrderPdf'

/** Construit le PDF d'un bon de commande (logo de l'enseigne chargé en data-URL). */
export async function buildPurchaseOrderPdfBlob(
  data: Omit<PoPdfData, 'logoUrl'>,
  mode: 'order' | 'blank',
): Promise<Blob> {
  const [{ pdf }, { PurchaseOrderPdf }, profile] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./PurchaseOrderPdf'),
    getProfile().catch(() => null),
  ])
  const logo = await toDataUrl(profile?.logoFile ? logoUrl(profile.logoFile) : null)
  return pdf(<PurchaseOrderPdf data={{ ...data, logoUrl: logo }} mode={mode} />).toBlob()
}
