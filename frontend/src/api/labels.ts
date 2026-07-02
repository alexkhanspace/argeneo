import { api } from './client'

/** Un badge d'un modèle : texte coloré (Kasher…) OU image (médaille, data URL). */
export interface LabelBadge {
  text?: string | null
  color?: string | null
  img?: string | null
}

/** Modèle d'étiquette réutilisable : mise en forme + badges (persisté côté serveur). */
export interface LabelTemplate {
  id: number
  name: string
  brand: string | null
  bgColor: string
  textColor: string
  borderColor: string
  widthCm: number
  heightCm: number
  fontScale: number
  showPrice: boolean
  frame: 'none' | 'wood'
  chalk: boolean
  fillSheet: boolean
  badgePos: 'tr' | 'tl' | 'footer'
  badgeScale: number
  extraText: string | null
  useDescription: boolean
  badges: LabelBadge[]
  /** Modèle appliqué aux produits sans modèle propre à l'impression (au plus un par enseigne). */
  enseigneDefault: boolean
}

// `enseigneDefault` est piloté par un endpoint dédié (toggle), pas par create/update.
export type LabelTemplateInput = Omit<LabelTemplate, 'id' | 'enseigneDefault'>

export async function listLabelTemplates(): Promise<LabelTemplate[]> {
  const { data } = await api.get<LabelTemplate[]>('/label-templates')
  return data
}

export async function createLabelTemplate(input: LabelTemplateInput): Promise<LabelTemplate> {
  const { data } = await api.post<LabelTemplate>('/label-templates', input)
  return data
}

export async function updateLabelTemplate(
  id: number,
  input: LabelTemplateInput,
): Promise<LabelTemplate> {
  const { data } = await api.put<LabelTemplate>(`/label-templates/${id}`, input)
  return data
}

export async function deleteLabelTemplate(id: number): Promise<void> {
  await api.delete(`/label-templates/${id}`)
}

/** Bascule le « modèle par défaut de l'enseigne » ; renvoie la liste des modèles à jour. */
export async function toggleDefaultLabelTemplate(id: number): Promise<LabelTemplate[]> {
  const { data } = await api.put<LabelTemplate[]>(`/label-templates/${id}/default`)
  return data
}

/** Affecte en masse des produits à un modèle (règle leur modèle par défaut). */
export async function assignArticlesToTemplate(id: number, articleIds: number[]): Promise<void> {
  await api.post(`/label-templates/${id}/articles`, { articleIds })
}
