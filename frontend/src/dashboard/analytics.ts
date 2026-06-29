import type { Article, DailyEntry } from '../api/types'

export const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export const eur = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const eur2 = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
export const intFr = (v: number): string => Math.round(v).toLocaleString('fr-FR')
// Date locale au format ISO (PAS toISOString, qui convertit en UTC → décalage en fuseau France).
const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const todayIso = (): string => localIso(new Date())
/** La veille (hier) au format ISO — la journée du jour étant souvent incomplète. */
export const yesterdayIso = (): string => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return localIso(d)
}

/** Format compact pour les axes : « 12,5 k€ » au-delà de 1000, sinon « 850 € ». */
export const eurAxis = (v: number | null | undefined): string => {
  if (v == null) return ''
  return Math.abs(v) >= 1000
    ? `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`
    : `${Math.round(v)} €`
}

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
  labels: string[]
  caCur: number[]
  caPrev: number[]
  ticketCur: number[]
  ticketPrev: number[]
  weekdayCur: number[]
  weekdayPrev: number[]
  /** Libellés des jours de semaine effectivement représentés (jours exclus retirés). */
  weekdayLabels: string[]
  deltaPct: number | null
  /** CA comparables derrière l'écart % : période courante et N-1 (à durée égale). */
  curRef: number
  prevRef: number
  todayCA: number | null
  todayClients: number | null
  yesterdayCA: number | null
  yesterdayClients: number | null
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
  let lossAmountTotal = 0
  const lossByArticle = new Map<string, { qty: number; value: number }>()
  const byMonth = new Map<string, MonthAgg>()
  const wd = WEEKDAYS.map(() => ({ ca: 0, n: 0 }))

  for (const e of entries) {
    const key = e.date.slice(0, 7)
    const cur = byMonth.get(key) ?? { ca: 0, clients: 0, loss: 0, days: 0 }
    cur.ca += e.revenue ?? 0
    cur.clients += e.clientCount ?? 0
    cur.days += e.revenue != null ? 1 : 0
    // Perte saisie en valeur (€), indépendante du détail par article.
    const la = e.lossAmount ?? 0
    lossValue += la
    lossAmountTotal += la
    cur.loss += la
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
    lossByArticle: (() => {
      const arr = [...lossByArticle.entries()].map(([name, v]) => ({ name, ...v }))
      if (lossAmountTotal > 0) arr.push({ name: 'Saisie directe (€)', qty: 0, value: lossAmountTotal })
      return arr.sort((a, b) => b.value - a.value)
    })(),
    best: [...days].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0)).slice(0, 10),
    todayCA: today?.revenue ?? null,
    todayClients: today?.clientCount ?? null,
  }
}

/**
 * Comparaison CA mensuel N vs N-1. L'écart % est calculé « à date » (year-to-date) :
 * on compare l'année en cours (jusqu'à hier) à la MÊME période de l'an dernier — sinon
 * une année en cours non terminée paraît toujours en forte baisse.
 */
export function compare(compEntries: DailyEntry[]): Comparison {
  const now = new Date()
  const y = now.getFullYear()
  // Borne « même jour l'an dernier » (mois/jour d'hier), pour une comparaison à période égale.
  const yest = new Date()
  yest.setDate(yest.getDate() - 1)
  const cutoffPrev = `${y - 1}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`

  const caCur = Array(12).fill(0)
  const caPrev = Array(12).fill(0)
  const clCur = Array(12).fill(0)
  const clPrev = Array(12).fill(0)
  const wdCur = WEEKDAYS.map(() => ({ ca: 0, n: 0 }))
  const wdPrev = WEEKDAYS.map(() => ({ ca: 0, n: 0 }))
  let curYtd = 0
  let prevYtd = 0
  const today = todayIso()
  const yestIso = yesterdayIso()
  let todayCA: number | null = null
  let todayClients: number | null = null
  let yesterdayCA: number | null = null
  let yesterdayClients: number | null = null

  for (const e of compEntries) {
    const yr = Number(e.date.slice(0, 4))
    const mo = Number(e.date.slice(5, 7)) - 1
    const wi = (() => {
      const [yy, mm, dd] = e.date.split('-').map(Number)
      return (new Date(yy, mm - 1, dd).getDay() + 6) % 7
    })()
    const rev = e.revenue ?? 0
    const cl = e.clientCount ?? 0
    if (e.date === today) {
      todayCA = e.revenue ?? null
      todayClients = e.clientCount ?? null
    }
    if (e.date === yestIso) {
      yesterdayCA = e.revenue ?? null
      yesterdayClients = e.clientCount ?? null
    }
    if (yr === y) {
      caCur[mo] += rev
      clCur[mo] += cl
      curYtd += rev
      if (e.revenue != null) {
        wdCur[wi].ca += rev
        wdCur[wi].n += 1
      }
    } else if (yr === y - 1) {
      caPrev[mo] += rev
      clPrev[mo] += cl
      if (e.date <= cutoffPrev) prevYtd += rev
      if (e.revenue != null) {
        wdPrev[wi].ca += rev
        wdPrev[wi].n += 1
      }
    }
  }
  const ticket = (ca: number, cl: number) => (cl ? Number((ca / cl).toFixed(2)) : 0)
  return {
    y,
    labels: MONTHS_SHORT,
    caCur: caCur.map((v) => Math.round(v)),
    caPrev: caPrev.map((v) => Math.round(v)),
    ticketCur: caCur.map((c, i) => ticket(c, clCur[i])),
    ticketPrev: caPrev.map((c, i) => ticket(c, clPrev[i])),
    weekdayCur: wdCur.map((w) => (w.n ? Math.round(w.ca / w.n) : 0)),
    weekdayPrev: wdPrev.map((w) => (w.n ? Math.round(w.ca / w.n) : 0)),
    weekdayLabels: [...WEEKDAYS],
    deltaPct: prevYtd > 0 ? ((curYtd - prevYtd) / prevYtd) * 100 : curYtd > 0 ? 100 : null,
    curRef: Math.round(curYtd),
    prevRef: Math.round(prevYtd),
    todayCA,
    todayClients,
    yesterdayCA,
    yesterdayClients,
  }
}
