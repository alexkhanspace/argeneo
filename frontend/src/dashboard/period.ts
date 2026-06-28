import type { DailyEntry } from '../api/types'
import { MONTHS_SHORT, WEEKDAYS, type Comparison } from './analytics'

export type Gran = 'jour' | 'semaine' | 'mois' | 'annee'

export const GRANS: { value: Gran; label: string }[] = [
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'annee', label: 'Année' },
]

const COUNT: Record<Gran, number> = { jour: 14, semaine: 12, mois: 12, annee: 5 }

// --- helpers date ---
const pad = (n: number) => String(n).padStart(2, '0')
// Date locale (PAS toISOString, qui convertit en UTC → décalage d'un jour en fuseau France).
const toIso = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (iso: string, n: number) => {
  const dt = parse(iso)
  dt.setDate(dt.getDate() + n)
  return toIso(dt)
}
const mondayOf = (iso: string) => {
  const dt = parse(iso)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  return toIso(dt)
}
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}
const lastDayOfMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return toIso(new Date(y, m, 0))
}
const weekdayMon0 = (iso: string) => (parse(iso).getDay() + 6) % 7

// --- clés de bucket ---
export const keyOf = (iso: string, g: Gran): string =>
  g === 'jour' ? iso : g === 'semaine' ? mondayOf(iso) : g === 'mois' ? iso.slice(0, 7) : iso.slice(0, 4)

export const stepKey = (key: string, g: Gran, n: number): string =>
  g === 'jour'
    ? addDays(key, n)
    : g === 'semaine'
      ? addDays(key, 7 * n)
      : g === 'mois'
        ? addMonths(key, n)
        : String(Number(key) + n)

const prevYearKey = (key: string, g: Gran): string => {
  if (g === 'annee') return String(Number(key) - 1)
  if (g === 'mois') return `${Number(key.slice(0, 4)) - 1}-${key.slice(5)}`
  const prev = `${Number(key.slice(0, 4)) - 1}${key.slice(4)}`
  return g === 'semaine' ? mondayOf(prev) : prev
}

const bucketStart = (key: string, g: Gran): string =>
  g === 'mois' ? `${key}-01` : g === 'annee' ? `${key}-01-01` : key
const bucketEnd = (key: string, g: Gran): string =>
  g === 'jour' ? key : g === 'semaine' ? addDays(key, 6) : g === 'mois' ? lastDayOfMonth(key) : `${key}-12-31`

export const labelOf = (key: string, g: Gran): string => {
  if (g === 'annee') return key
  if (g === 'mois') return `${MONTHS_SHORT[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`
  return `${key.slice(8)}/${key.slice(5, 7)}` // JJ/MM
}

/** Période par défaut : J-1, S-1, M-1, et Année = année en cours. */
export const defaultRefKey = (g: Gran, today: string): string => {
  if (g === 'annee') return today.slice(0, 4)
  if (g === 'jour') return addDays(today, -1)
  if (g === 'mois') return addMonths(today.slice(0, 7), -1)
  return stepKey(mondayOf(today), 'semaine', -1) // semaine précédente
}

const firstKey = (g: Gran, refKey: string) => stepKey(refKey, g, -(COUNT[g] - 1))

/** Plage [from, to] couverte par la fenêtre (bornée à aujourd'hui). */
export const windowRange = (g: Gran, refKey: string, today: string) => {
  const from = bucketStart(firstKey(g, refKey), g)
  let to = bucketEnd(refKey, g)
  if (to > today) to = today
  return { from, to }
}

/** Plus ancienne date à récupérer (inclut l'an N-1 du premier bucket). */
export const fetchFrom = (g: Gran, refKey: string) =>
  bucketStart(prevYearKey(firstKey(g, refKey), g), g)

/** Libellé lisible de la période sélectionnée (en-tête du navigateur). */
export const refLabel = (g: Gran, refKey: string): string => {
  if (g === 'annee') return `Année ${refKey}`
  if (g === 'mois') {
    const dt = parse(`${refKey}-01`)
    return dt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }
  if (g === 'jour') {
    return parse(refKey).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })
  }
  return `Semaine du ${refKey.slice(8)}/${refKey.slice(5, 7)}`
}

/** Série N vs N-1 à la granularité choisie (structure Comparison réutilisée par les widgets). */
export function buildSeries(entries: DailyEntry[], g: Gran, refKey: string, today: string): Comparison {
  const n = COUNT[g]
  const curKeys = Array.from({ length: n }, (_, i) => stepKey(refKey, g, -(n - 1 - i)))
  const prevKeys = curKeys.map((k) => prevYearKey(k, g))

  const byKey = new Map<string, { ca: number; clients: number }>()
  const dayMap = new Map<string, { ca: number; clients: number }>()
  for (const e of entries) {
    const rev = e.revenue ?? 0
    const cl = e.clientCount ?? 0
    const k = keyOf(e.date, g)
    const b = byKey.get(k) ?? { ca: 0, clients: 0 }
    b.ca += rev
    b.clients += cl
    byKey.set(k, b)
    dayMap.set(e.date, { ca: rev, clients: cl })
  }
  const ca = (k: string) => byKey.get(k)?.ca ?? 0
  const cl = (k: string) => byKey.get(k)?.clients ?? 0
  const ticket = (c: number, n2: number) => (n2 ? Number((c / n2).toFixed(2)) : 0)

  // Jour de la semaine (CA moyen) sur la fenêtre courante / N-1.
  const curSet = new Set(curKeys)
  const prevSet = new Set(prevKeys)
  const wdCur = WEEKDAYS.map(() => ({ ca: 0, n: 0 }))
  const wdPrev = WEEKDAYS.map(() => ({ ca: 0, n: 0 }))
  for (const e of entries) {
    if (e.revenue == null) continue
    const k = keyOf(e.date, g)
    const wi = weekdayMon0(e.date)
    if (curSet.has(k)) {
      wdCur[wi].ca += e.revenue
      wdCur[wi].n += 1
    } else if (prevSet.has(k)) {
      wdPrev[wi].ca += e.revenue
      wdPrev[wi].n += 1
    }
  }

  // Écart % : période sélectionnée (dernier bucket) vs N-1, à durée égale si bucket en cours.
  const refStart = bucketStart(refKey, g)
  const cappedEnd = bucketEnd(refKey, g) > today ? today : bucketEnd(refKey, g)
  const elapsed = Math.round((parse(cappedEnd).getTime() - parse(refStart).getTime()) / 86400000)
  const prevStart = bucketStart(prevYearKey(refKey, g), g)
  const sumRange = (a: string, b: string) => {
    let s = 0
    for (let d = a; d <= b; d = addDays(d, 1)) s += dayMap.get(d)?.ca ?? 0
    return s
  }
  const curRef = sumRange(refStart, cappedEnd)
  const prevRef = sumRange(prevStart, addDays(prevStart, elapsed))

  const yest = addDays(today, -1)
  return {
    y: Number(today.slice(0, 4)),
    labels: curKeys.map((k) => labelOf(k, g)),
    caCur: curKeys.map((k) => Math.round(ca(k))),
    caPrev: prevKeys.map((k) => Math.round(ca(k))),
    ticketCur: curKeys.map((k) => ticket(ca(k), cl(k))),
    ticketPrev: prevKeys.map((k) => ticket(ca(k), cl(k))),
    weekdayCur: wdCur.map((w) => (w.n ? Math.round(w.ca / w.n) : 0)),
    weekdayPrev: wdPrev.map((w) => (w.n ? Math.round(w.ca / w.n) : 0)),
    deltaPct: prevRef > 0 ? ((curRef - prevRef) / prevRef) * 100 : null,
    todayCA: dayMap.get(today)?.ca ?? null,
    todayClients: dayMap.get(today)?.clients ?? null,
    yesterdayCA: dayMap.get(yest)?.ca ?? null,
    yesterdayClients: dayMap.get(yest)?.clients ?? null,
  }
}
