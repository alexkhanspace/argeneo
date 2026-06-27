/**
 * Jours fériés français (métropole) via l'API Etalab (gratuite, sans clé) :
 * https://calendrier.api.gouv.fr — gère les fériés mobiles (Pâques, Ascension…).
 * Renvoie un map date ISO (YYYY-MM-DD) → libellé du jour férié.
 */

export type Holidays = Record<string, string>

const cache = new Map<number, Holidays>()

export async function getHolidays(year: number): Promise<Holidays> {
  const cached = cache.get(year)
  if (cached) return cached
  try {
    const res = await fetch(`https://calendrier.api.gouv.fr/jours-feries/metropole/${year}.json`)
    if (!res.ok) throw new Error('Jours fériés indisponibles')
    const data = (await res.json()) as Holidays
    cache.set(year, data)
    return data
  } catch {
    return {}
  }
}
