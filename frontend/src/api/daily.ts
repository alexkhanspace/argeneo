import { api } from './client'
import type { DailyEntry, MyEtablissement } from './types'

// Établissements accessibles à l'utilisateur courant, avec ses permissions.
export async function listMyEtablissements(): Promise<MyEtablissement[]> {
  const { data } = await api.get<MyEtablissement[]>('/me/etablissements')
  return data
}

// Saisie d'un jour pour un établissement (date ISO YYYY-MM-DD).
export async function getDay(etablissementId: number, date: string): Promise<DailyEntry> {
  const { data } = await api.get<DailyEntry>(`/etablissements/${etablissementId}/daily/${date}`)
  return data
}

// Saisies sur une plage (seuls les jours renseignés sont renvoyés).
export async function listMonth(
  etablissementId: number,
  from: string,
  to: string,
): Promise<DailyEntry[]> {
  const { data } = await api.get<DailyEntry[]>(`/etablissements/${etablissementId}/daily`, {
    params: { from, to },
  })
  return data
}

// Enregistrement global de la journée (CA, casse par article, mots du jour) — 1 requête.
export interface UpsertDailyInput {
  revenue?: number | null
  clientCount?: number | null
  losses: Array<{ articleId: number; quantity: number }>
  noteProd?: string | null
  noteSale?: string | null
}

export async function saveDay(
  etablissementId: number,
  date: string,
  input: UpsertDailyInput,
): Promise<DailyEntry> {
  const { data } = await api.put<DailyEntry>(
    `/etablissements/${etablissementId}/daily/${date}`,
    input,
  )
  return data
}
