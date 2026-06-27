import { api } from './client'

export interface SocialPostResponse {
  enabled: boolean
  model: string | null
  caption: string
}

export interface CommunicationSummary {
  id: number
  title: string
  platform: string | null
  articleId: number | null
  hasImage: boolean
  createdAt: string
}

export interface CommunicationDetail {
  id: number
  etablissementId: number | null
  brief: string | null
  platform: string | null
  tone: string | null
  length: string | null
  ambiance: string | null
  instruction: string | null
  headline: string | null
  caption: string | null
  articleId: number | null
  hasImage: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CommunicationInput {
  brief?: string | null
  platform?: string | null
  tone?: string | null
  length?: string | null
  ambiance?: string | null
  instruction?: string | null
  headline?: string | null
  caption?: string | null
  articleId?: number | null
}

/** Rédige une publication réseaux sociaux prête à publier (brief libre et/ou produit). */
export async function generateSocialPost(input: {
  etablissement: string
  description?: string | null
  location?: string | null
  brief?: string | null
  platform?: string | null
  tone?: string | null
  length?: string | null
  articleName?: string | null
  articleDescription?: string | null
  priceTtc?: number | null
}): Promise<SocialPostResponse> {
  const { data } = await api.post<SocialPostResponse>('/insights/social', input)
  return data
}

/** Génère un visuel (texte→image) à partir d'un brief. Renvoie le PNG (blob). */
export async function generateImageFromPrompt(prompt: string): Promise<Blob> {
  const { data } = await api.post('/ai/generate-image', { prompt }, { responseType: 'blob' })
  return data as Blob
}

// --- Archivage des communications ---
function toForm(input: CommunicationInput, imageBlob?: Blob | null): FormData {
  const form = new FormData()
  const add = (k: string, v: string | number | null | undefined) => {
    if (v != null && v !== '') form.append(k, String(v))
  }
  add('brief', input.brief)
  add('platform', input.platform)
  add('tone', input.tone)
  add('length', input.length)
  add('ambiance', input.ambiance)
  add('instruction', input.instruction)
  add('headline', input.headline)
  add('caption', input.caption)
  add('articleId', input.articleId)
  if (imageBlob) form.append('image', imageBlob, 'visuel.png')
  return form
}

export async function listCommunications(): Promise<CommunicationSummary[]> {
  const { data } = await api.get<CommunicationSummary[]>('/communications')
  return data
}

export async function getCommunication(id: number): Promise<CommunicationDetail> {
  const { data } = await api.get<CommunicationDetail>(`/communications/${id}`)
  return data
}

export async function saveCommunication(
  input: CommunicationInput,
  imageBlob?: Blob | null,
): Promise<CommunicationDetail> {
  const { data } = await api.post<CommunicationDetail>('/communications', toForm(input, imageBlob))
  return data
}

export async function updateCommunication(
  id: number,
  input: CommunicationInput,
  imageBlob?: Blob | null,
): Promise<CommunicationDetail> {
  const { data } = await api.put<CommunicationDetail>(`/communications/${id}`, toForm(input, imageBlob))
  return data
}

export async function deleteCommunication(id: number): Promise<void> {
  await api.delete(`/communications/${id}`)
}

export async function getCommunicationImage(id: number): Promise<Blob> {
  const { data } = await api.get(`/communications/${id}/image`, { responseType: 'blob' })
  return data as Blob
}
