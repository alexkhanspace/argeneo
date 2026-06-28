import type { Article, DailyEntry } from '../api/types'

export const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export const eur = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const eur2 = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
export const intFr = (v: number): string => Math.round(v).toLocaleString('fr-FR')
export const todayIso = (): string => new Date().toISOString().slice(0, 10)

/** Jour de la semaine 0=Lun..6=Dim depuis une date ISO (sans décalage de fuseau). */
const weekdayMon0 = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

export interface MonthAgg {
  ca: number
  clients: number
  loss: number
  days: number
}

export interface Agg {
  nbDays: number
  totalCA: number
  avgCA: number
  totalClients: number
  avgTicket: number
  lossValue: number
  lossUnits: number
  months: [string, MonthAgg][]
  monthLabels: string[]
  weekdayAvg: number[]
  lossByArticle: { name: string; qty: number; value: number }[]
  best: DailyEntry[]
  todayCA: number | null
  todayClients: number | null
}

export interface Comparison {
  y: number
  cur: number[]
  prev: number[]
  deltaPct: number | null
}

export function priceMap(articles: Article[]): Map<number, number> {
  const m = new Map<number, number>()
  articles.forEach((a) => m.set(a.id, a.salePriceTtc ?? 0))
  return m
}

/** Agrège la saisie quotidienne d'une période (CA, clients, ticket, pertes valorisées…). */
export function aggregate(entries: DailyEntry[], price: Map<number, number>): Agg {
  const days = entries.filter((e) => e.revenue != null)
  const totalCA = days.reduce((s, e) => s + (e.revenue ?? 0), 0)
  const totalClients = days.reduce((s, e) => s + (e.clientCount ?? 0), 0)
  const nbDays = days.length

  let lossValue = 0
  let lossUnits = 0
  const lossByArticle = new Map<string, { qty: number; value: number }>()
  const byMonth = new Map<string, MonthAgg>()
  const wd = WEEKDAYS.map(() => ({ ca: 0, n: 0 }))

  for (const e of entries) {
    const key = e.date.slice(0, 7)
    const cur = byMonth.get(key) ?? { ca: 0, clients: 0, loss: 0, days: 0 }
    cur.ca += e.revenue ?? 0
    cur.clients += e.clientCount ?? 0
    cur.days += e.revenue != null ? 1 : 0
    for (const l of e.losses ?? []) {
      const val = l.quantity * (price.get(l.articleId) ?? 0)
      lossValue += val
      lossUnits += l.quantity
      cur.loss += val
      const a = lossByArticle.get(l.articleName) ?? { qty: 0, value: 0 }
      a.qty += l.quantity
      a.value += val
      lossByArticle.set(l.articleName, a)
    }
    byMonth.set(key, cur)
  }
  for (const e of days) {
    const i = weekdayMon0(e.date)
    wd[i].ca += e.revenue ?? 0
    wd[i].n += 1
  }

  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
  const today = entries.find((e) => e.date === todayIso())

  return {
    nbDays,
    totalCA,
    totalClients,
    avgCA: nbDays ? totalCA / nbDays : 0,
    avgTicket: totalClients ? totalCA / totalClients : 0,
    lossValue,
    lossUnits,
    months,
    monthLabels: months.map(([k]) => {
      const [y, m] = k.split('-')
      return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`
    }),
    weekdayAvg: wd.map((w) => (w.n ? Math.round(w.ca / w.n) : 0)),
    lossByArticle: [...lossByArticle.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value),
    best: [...days].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0)).slice(0, 10),
    todayCA: today?.revenue ?? null,
    todayClients: today?.clientCount ?? null,
  }
}

/** Comparaison CA mensuel année courante (N) vs précédente (N-1) à partir des 2 années. */
export function compare(compEntries: DailyEntry[]): Comparison {
  const y = new Date().getFullYear()
  const cur = Array(12).fill(0)
  const prev = Array(12).fill(0)
  for (const e of compEntries) {
    const yr = Number(e.date.slice(0, 4))
    const mo = Number(e.date.slice(5, 7)) - 1
    if (yr === y) cur[mo] += e.revenue ?? 0
    else if (yr === y - 1) prev[mo] += e.revenue ?? 0
  }
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)
  return {
    y,
    cur: cur.map((v) => Math.round(v)),
    prev: prev.map((v) => Math.round(v)),
    deltaPct: sum(prev) > 0 ? ((sum(cur) - sum(prev)) / sum(prev)) * 100 : null,
  }
}
