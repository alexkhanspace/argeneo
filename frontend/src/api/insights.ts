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
  /** Événements à venir (demain / prochains jours) — pour repérer une VEILLE de férié/pont. */
  eventsNext?: string | null
}

/**
 * Axe de comparaison GLOBAL (partagé tableau de bord / calendrier / analytique) :
 * - 'habituel'  → vs un jour de semaine normal ;
 * - 'n1_equiv'  → vs le même JOUR de semaine l'an dernier (jour équivalent) ;
 * - 'n1_date'   → vs la même DATE l'an dernier (date à date).
 */
export type Baseline = 'habituel' | 'n1_equiv' | 'n1_date'

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

/**
 * Sublime/met en scène une photo réelle (image-to-image). Renvoie l'image transformée (blob).
 * `mode` = "scene" pour préserver une photo d'événement (personnes/objets) ; défaut = produit.
 */
export async function enhanceImage(
  file: File,
  ambiance?: string,
  instruction?: string,
  mode?: string,
  aspectRatio?: string,
): Promise<Blob> {
  const form = new FormData()
  form.append('file', file)
  if (ambiance) form.append('ambiance', ambiance)
  if (instruction) form.append('instruction', instruction)
  if (mode) form.append('mode', mode)
  if (aspectRatio) form.append('aspectRatio', aspectRatio)
  const { data } = await api.post('/ai/enhance-image', form, { responseType: 'blob' })
  return data as Blob
}

/**
 * Compose une affiche à partir de PLUSIEURS photos réelles (menu, sélection de produits).
 * L'IA met en scène les produits fournis dans un visuel unique (sans texte). Renvoie l'image (blob).
 */
export async function composeImages(
  files: File[],
  instruction?: string,
  aspectRatio?: string,
  mode?: string,
): Promise<Blob> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  if (instruction) form.append('instruction', instruction)
  if (aspectRatio) form.append('aspectRatio', aspectRatio)
  if (mode) form.append('mode', mode)
  const { data } = await api.post('/ai/compose-image', form, { responseType: 'blob' })
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

/** Un jour à analyser dans le batch, avec son mode. */
export interface DayAnalysisItemInput {
  mode: 'action' | 'bilan' | 'prep'
  detail?: boolean
  day: DayContextInput
}

/** Analyse d'un jour renvoyée par le batch (associée à sa date). */
export interface DayAnalysisItemOut {
  date: string
  mode: string
  analysis: string
}

export interface DaysAnalysisResponse {
  enabled: boolean
  model: string | null
  analyses: DayAnalysisItemOut[]
}

/**
 * Analyse PLUSIEURS journées (J-1 / J / J+1) en UN seul appel — pour le cockpit du tableau de bord.
 * Le backend regroupe tout en une requête Gemini et met le résultat en cache.
 */
export async function getDaysAnalysis(input: {
  etablissement: string
  description?: string | null
  location?: string | null
  baseline?: Baseline
  items: DayAnalysisItemInput[]
}): Promise<DaysAnalysisResponse> {
  const { data } = await api.post<DaysAnalysisResponse>('/insights/days', input)
  return data
}
