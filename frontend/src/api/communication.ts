import { api } from './client'

export interface SocialPostResponse {
  enabled: boolean
  model: string | null
  caption: string
}

/** Rédige une publication réseaux sociaux prête à publier à partir d'un brief libre. */
export async function generateSocialPost(input: {
  etablissement: string
  description?: string | null
  location?: string | null
  brief: string
  platform?: string | null
  tone?: string | null
}): Promise<SocialPostResponse> {
  const { data } = await api.post<SocialPostResponse>('/insights/social', input)
  return data
}

/** Génère un visuel (texte→image) à partir d'un brief. Renvoie le PNG (blob). */
export async function generateImageFromPrompt(prompt: string): Promise<Blob> {
  const { data } = await api.post('/ai/generate-image', { prompt }, { responseType: 'blob' })
  return data as Blob
}
