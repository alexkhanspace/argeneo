import { api } from './client'

/** Contexte d'un jour à venir envoyé à l'analyse de tendance (Gemini). */
export interface DayContextInput {
  date: string
  weekday?: string | null
  revenue?: number | null
  clientCount?: number | null
  tMax?: number | null
  tMaxN1?: number | null
  events?: string | null
  caN1Date?: number | null
  caN1Equiv?: number | null
  noteProd?: string | null
  noteSale?: string | null
  /** Mots du jour du même jour l'an dernier (AR) — contexte qualitatif pour l'IA. */
  noteProdN1?: string | null
  noteSaleN1?: string | null
  /** Événements du même jour de semaine N-1 (AR) et de la même date N-1 (AA). */
  eventsAr?: string | null
  eventsAa?: string | null
  /** Condition du ciel (ex. « Pluie », « Ciel dégagé ») pour J et le même jour N-1. */
  sky?: string | null
  skyN1?: string | null
  /** Résumé horaire du jour (matin/midi/après-midi/soir) — quand il pleut, etc. */
  hourly?: string | null
}

export type Baseline = 'habituel' | 'n1'

export interface TrendInput {
  etablissement: string
  description?: string | null
  /** Adresse de l'établissement (pour contextualiser climat/habitudes locales). */
  location?: string | null
  periode?: string
  baseline?: Baseline
  days: DayContextInput[]
}

export interface DayAdvice {
  date: string
  conseil: string
}

export interface TrendResponse {
  enabled: boolean
  model: string | null
  days: DayAdvice[]
}

/** Demande un avis de tendance (production / appro) sur les prochains jours. */
export async function getTrend(input: TrendInput): Promise<TrendResponse> {
  const { data } = await api.post<TrendResponse>('/insights/trend', input)
  return data
}

export interface DayAnalysisResponse {
  enabled: boolean
  model: string | null
  analysis: string
}

export interface PricingResponse {
  enabled: boolean
  model: string | null
  advice: string
}

export interface AdCopyResponse {
  enabled: boolean
  model: string | null
  slogans: string[]
}

/** Sublime/met en scène une photo réelle (image-to-image). Renvoie l'image transformée (blob). */
export async function enhanceImage(file: File, ambiance?: string, instruction?: string): Promise<Blob> {
  const form = new FormData()
  form.append('file', file)
  if (ambiance) form.append('ambiance', ambiance)
  if (instruction) form.append('instruction', instruction)
  const { data } = await api.post('/ai/enhance-image', form, { responseType: 'blob' })
  return data as Blob
}

/** Accroches publicitaires (3 variantes) pour annoncer une nouveauté. */
export async function getAdSlogans(input: {
  etablissement: string
  description?: string | null
  location?: string | null
  articleName: string
  articleDescription?: string | null
  priceTtc?: number | null
}): Promise<AdCopyResponse> {
  const { data } = await api.post<AdCopyResponse>('/insights/ad', input)
  return data
}

/** Avis IA sur le prix de vente d'un article (cohérence + marge + prix psycho). */
export async function getPricingAdvice(input: {
  etablissement: string
  description?: string | null
  location?: string | null
  articleName: string
  articleType?: string | null
  articleDescription?: string | null
  pnetHt?: number | null
  vatRate?: number | null
  priceTtc?: number | null
}): Promise<PricingResponse> {
  const { data } = await api.post<PricingResponse>('/insights/pricing', input)
  return data
}

/** Analyse d'UNE journée précise (toujours une réponse) — pour le tableau de bord. */
export async function getDayAnalysis(input: {
  etablissement: string
  description?: string | null
  location?: string | null
  mode?: 'action' | 'bilan' | 'prep'
  baseline?: Baseline
  /** true → l'IA développe une analyse plus complète (bouton « Développer »). */
  detail?: boolean
  day: DayContextInput
}): Promise<DayAnalysisResponse> {
  const { data } = await api.post<DayAnalysisResponse>('/insights/day', input)
  return data
}
