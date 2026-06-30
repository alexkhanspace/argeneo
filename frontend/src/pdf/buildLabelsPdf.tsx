import type { LabelsPdfData } from './LabelsPdf'
import { getProfile, logoUrl } from '../api/billing'

async function toDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Construit le blob PDF d'une planche d'étiquettes — le logo entreprise est récupéré ici. */
export async function buildLabelsPdfBlob(data: Omit<LabelsPdfData, 'logoUrl'>): Promise<Blob> {
  const [{ pdf }, { LabelsPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./LabelsPdf')])
  const profile = await getProfile().catch(() => null)
  const logo = await toDataUrl(profile?.logoFile ? logoUrl(profile.logoFile) : null)
  return pdf(<LabelsPdf data={{ ...data, logoUrl: logo }} />).toBlob()
}
