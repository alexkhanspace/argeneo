/**
 * Événements culturels à Mulhouse via le jeu de données public OpenAgenda sur
 * Opendatasoft (gratuit, sans clé). Conservé comme source de contexte (ex. pour
 * l'analyse de tendance) : on récupère les événements actifs à une date donnée.
 */

export interface CulturalEvent {
  title: string
  time: string | null
}

const cache = new Map<string, CulturalEvent[]>()

const DATASET =
  'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/evenements-publics-openagenda/records'

function timeIfSameDay(begin: string | null, iso: string): string | null {
  if (!begin || !begin.startsWith(iso)) return null
  const t = begin.slice(11, 16)
  return t || null
}

export async function getEventsForDay(iso: string): Promise<CulturalEvent[]> {
  const cached = cache.get(iso)
  if (cached) return cached
  const where =
    `location_city="Mulhouse" and firstdate_begin<="${iso}T23:59:59" ` +
    `and lastdate_end>="${iso}T00:00:00"`
  const params = new URLSearchParams({
    where,
    select: 'title_fr,firstdate_begin',
    order_by: 'firstdate_begin',
    limit: '6',
  })
  try {
    const res = await fetch(`${DATASET}?${params.toString()}`)
    if (!res.ok) throw new Error('Événements indisponibles')
    const json = (await res.json()) as {
      results?: { title_fr?: string; firstdate_begin?: string }[]
    }
    const events: CulturalEvent[] = (json.results ?? [])
      .filter((r) => r.title_fr)
      .map((r) => ({ title: r.title_fr as string, time: timeIfSameDay(r.firstdate_begin ?? null, iso) }))
    cache.set(iso, events)
    return events
  } catch {
    return []
  }
}
