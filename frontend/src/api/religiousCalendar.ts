/**
 * Repères des calendriers musulman (Aladhan) et juif (Hebcal) — gratuits, sans
 * clé — pour surligner Ramadan, Aïd, fêtes juives, etc. sur le calendrier.
 * Tout est mappé par date ISO (YYYY-MM-DD) pour le mois demandé.
 */

export type DayLabels = Record<string, string>

const muslimCache = new Map<string, DayLabels>()
const jewishCache = new Map<string, DayLabels>()

function key(year: number, month0: number) {
  return `${year}-${month0}`
}

/** Jours musulmans notables du mois (Ramadan, Aïd…) via Aladhan gToHCalendar. */
export async function getMuslimDays(year: number, month0: number): Promise<DayLabels> {
  const k = key(year, month0)
  const cached = muslimCache.get(k)
  if (cached) return cached
  try {
    const res = await fetch(`https://api.aladhan.com/v1/gToHCalendar/${month0 + 1}/${year}`)
    if (!res.ok) throw new Error()
    const json = (await res.json()) as {
      data?: { gregorian: { date: string }; hijri: { day: string; month: { number: number } } }[]
    }
    const out: DayLabels = {}
    for (const d of json.data ?? []) {
      const [dd, mm, yy] = d.gregorian.date.split('-') // DD-MM-YYYY
      const iso = `${yy}-${mm}-${dd}`
      const hm = d.hijri.month.number
      const hd = Number(d.hijri.day)
      let label: string | null = null
      if (hm === 9) label = `Ramadan (j.${hd})`
      else if (hm === 10 && hd === 1) label = 'Aïd el-Fitr'
      else if (hm === 12 && hd === 10) label = 'Aïd el-Adha'
      else if (hm === 1 && hd === 1) label = 'Nouvel an hégirien'
      else if (hm === 3 && hd === 12) label = 'Mawlid'
      if (label) out[iso] = label
    }
    muslimCache.set(k, out)
    return out
  } catch {
    return {}
  }
}

/** Fêtes juives du mois (fr) via Hebcal. Shabbat (samedis) est géré côté UI. */
export async function getJewishDays(year: number, month0: number): Promise<DayLabels> {
  const k = key(year, month0)
  const cached = jewishCache.get(k)
  if (cached) return cached
  try {
    // maj uniquement = grandes fêtes (pas les Rosh Hodech ni fêtes mineures).
    const params = new URLSearchParams({
      v: '1',
      cfg: 'json',
      year: String(year),
      month: String(month0 + 1),
      maj: 'on',
      lg: 'fr',
      geo: 'none',
    })
    const res = await fetch(`https://www.hebcal.com/hebcal?${params.toString()}`)
    if (!res.ok) throw new Error()
    const json = (await res.json()) as {
      items?: { date: string; category: string; title: string }[]
    }
    const keep = new Set(['holiday'])
    const out: DayLabels = {}
    for (const it of json.items ?? []) {
      if (!keep.has(it.category)) continue
      // On ignore les « veilles » (Erev …), secondaires.
      if (it.title.startsWith('Erev')) continue
      const iso = it.date.slice(0, 10)
      out[iso] = out[iso] ? `${out[iso]} · ${it.title}` : it.title
    }
    jewishCache.set(k, out)
    return out
  } catch {
    return {}
  }
}
