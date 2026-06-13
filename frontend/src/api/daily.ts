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

// CA (TTC).
export async function setRevenue(
  etablissementId: number,
  date: string,
  revenue: number,
): Promise<void> {
  await api.put(`/etablissements/${etablissementId}/daily/${date}/revenue`, { revenue })
}

export async function setLoss(etablissementId: number, date: string, loss: number): Promise<void> {
  await api.put(`/etablissements/${etablissementId}/daily/${date}/loss`, { loss })
}

export async function setNote(etablissementId: number, date: string, note: string): Promise<void> {
  await api.put(`/etablissements/${etablissementId}/daily/${date}/note`, { note })
}
