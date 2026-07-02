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
}

export type LabelTemplateInput = Omit<LabelTemplate, 'id'>

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
