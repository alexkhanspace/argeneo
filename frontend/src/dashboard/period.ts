import type { DailyEntry } from '../api/types'
import { MONTHS_SHORT, WEEKDAYS, type Comparison } from './analytics'

export type Gran = 'jour' | 'semaine' | 'mois' | 'annee'

/**
 * Alignement de la comparaison N-1 :
 * - 'equiv' = jour équivalent (même jour de semaine, −364 j / −52 sem.)
 * - 'date'  = date à date (même date calendaire l'an dernier)
 */
export type CompareMode = 'equiv' | 'date'

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

/**
 * Clé N-1 selon le mode. En « jour équivalent », on recule de 364 jours (= 52 semaines)
 * pour conserver le même jour de semaine — pertinent au jour et à la semaine. Au mois et à
 * l'année, le bucket reste calé sur l'an dernier (alignement par jour de semaine sans objet).
 */
const prevKeyOf = (key: string, g: Gran, mode: CompareMode): string =>
  mode === 'equiv' && (g === 'jour' || g === 'semaine') ? addDays(key, -364) : prevYearKey(key, g)

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

/** Plage [from, to] de la SEULE période sélectionnée (le bucket courant), bornée à aujourd'hui. */
export const bucketRange = (g: Gran, refKey: string, today: string) => {
  const from = bucketStart(refKey, g)
  let to = bucketEnd(refKey, g)
  if (to > today) to = today
  return { from, to }
}

/** Plus ancienne date à récupérer (inclut l'an N-1 du premier bucket). */
export const fetchFrom = (g: Gran, refKey: string) =>
  bucketStart(prevYearKey(firstKey(g, refKey), g), g)

/** Majuscule sur la 1re lettre seulement (les mois/jours fr restent en minuscules ensuite). */
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** Numéro de semaine ISO 8601 à partir du lundi de la semaine. */
const isoWeek = (mondayIso: string): number => {
  const [y, m, d] = mondayIso.split('-').map(Number)
  const thu = new Date(Date.UTC(y, m - 1, d + 3)) // jeudi de la semaine → détermine l'année ISO
  const jan1 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  return Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
}

/** Libellé lisible de la période sélectionnée (en-tête du navigateur). */
export const refLabel = (g: Gran, refKey: string): string => {
  if (g === 'annee') return `Année ${refKey}`
  if (g === 'mois') return cap(parse(`${refKey}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))
  if (g === 'jour')
    return cap(parse(refKey).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' }))
  // Semaine : numéro ISO + plage lundi → dimanche.
  const end = addDays(refKey, 6)
  return `Semaine S${isoWeek(refKey)} du ${refKey.slice(8)}/${refKey.slice(5, 7)} au ${end.slice(8)}/${end.slice(5, 7)}`
}

/** Série N vs N-1 à la granularité choisie (structure Comparison réutilisée par les widgets). */
export function buildSeries(
  entries: DailyEntry[],
  g: Gran,
  refKey: string,
  today: string,
  mode: CompareMode = 'date',
  included: number[] = [0, 1, 2, 3, 4, 5, 6],
): Comparison {
  const n = COUNT[g]
  const curKeys = Array.from({ length: n }, (_, i) => stepKey(refKey, g, -(n - 1 - i)))
  const prevKeys = curKeys.map((k) => prevKeyOf(k, g, mode))

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
  // En « jour équivalent », la fenêtre N-1 recule de 364 j (jours de semaine alignés) ;
  // en « date à date », on se cale sur le même bucket l'an dernier.
  const prevStart =
    mode === 'equiv' && g !== 'annee' ? addDays(refStart, -364) : bucketStart(prevYearKey(refKey, g), g)
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
    // On ne représente que les jours de semaine inclus (jours exclus retirés du graphe).
    weekdayCur: included.map((i) => (wdCur[i].n ? Math.round(wdCur[i].ca / wdCur[i].n) : 0)),
    weekdayPrev: included.map((i) => (wdPrev[i].n ? Math.round(wdPrev[i].ca / wdPrev[i].n) : 0)),
    weekdayLabels: included.map((i) => WEEKDAYS[i]),
    // Pas de CA N-1 mais du CA cette année → +100 % (du nouveau) ; rien des deux côtés → pas de badge.
    deltaPct: prevRef > 0 ? ((curRef - prevRef) / prevRef) * 100 : curRef > 0 ? 100 : null,
    curRef: Math.round(curRef),
    prevRef: Math.round(prevRef),
    todayCA: dayMap.get(today)?.ca ?? null,
    todayClients: dayMap.get(today)?.clients ?? null,
    yesterdayCA: dayMap.get(yest)?.ca ?? null,
    yesterdayClients: dayMap.get(yest)?.clients ?? null,
  }
}

/** Détail du CA À L'INTÉRIEUR de la période choisie, sous-unité par sous-unité, N vs N-1. */
export interface BucketSeries {
  /** Type de graphe conseillé selon la granularité. */
  kind: 'line' | 'bar'
  labels: string[]
  /** CA de la période choisie (année N). */
  caCur: number[]
  /** CA de la même période l'an dernier (N-1). */
  caPrev: number[]
  curLabel: string
  prevLabel: string
  title: string
  /** Vrai quand la granularité ne se prête pas à un détail interne (jour). */
  empty: boolean
}

/**
 * Décompose la période sélectionnée en ses sous-unités et compare à N-1 :
 * mois → un point par jour (2026 vs 2025), année → un point par mois,
 * semaine → un point par jour de la semaine. Le jour n'a pas de détail interne.
 */
export function buildBucketSeries(
  entries: DailyEntry[],
  g: Gran,
  refKey: string,
  mode: CompareMode = 'date',
  included: number[] = [0, 1, 2, 3, 4, 5, 6],
): BucketSeries {
  const caByDate = new Map<string, number>()
  for (const e of entries) caByDate.set(e.date, (caByDate.get(e.date) ?? 0) + (e.revenue ?? 0))
  const ca = (iso: string) => Math.round(caByDate.get(iso) ?? 0)
  const includedSet = new Set(included)

  if (g === 'mois') {
    const [y, m] = refKey.split('-').map(Number)
    const days = new Date(y, m, 0).getDate()
    const labels: string[] = []
    const caCur: number[] = []
    const caPrev: number[] = []
    for (let d = 1; d <= days; d++) {
      const dd = pad(d)
      const cur = `${y}-${pad(m)}-${dd}`
      // Jours de semaine exclus (p. ex. dimanche) : retirés du graphe, pas affichés à 0.
      if (!includedSet.has(weekdayMon0(cur))) continue
      // jour équivalent : même jour de semaine l'an dernier (−364 j) ; sinon même date.
      const prev = mode === 'equiv' ? addDays(cur, -364) : `${y - 1}-${pad(m)}-${dd}`
      labels.push(String(d))
      caCur.push(ca(cur))
      caPrev.push(ca(prev))
    }
    return {
      kind: 'line', labels, caCur, caPrev,
      curLabel: String(y), prevLabel: String(y - 1),
      title: `CA par jour — ${refLabel('mois', refKey)}`,
      empty: false,
    }
  }

  if (g === 'annee') {
    const y = Number(refKey)
    const cur = Array(12).fill(0)
    const prev = Array(12).fill(0)
    for (const e of entries) {
      const yr = Number(e.date.slice(0, 4))
      const mo = Number(e.date.slice(5, 7)) - 1
      if (yr === y) cur[mo] += e.revenue ?? 0
      else if (yr === y - 1) prev[mo] += e.revenue ?? 0
    }
    return {
      kind: 'bar', labels: [...MONTHS_SHORT],
      caCur: cur.map((v) => Math.round(v)), caPrev: prev.map((v) => Math.round(v)),
      curLabel: String(y), prevLabel: String(y - 1),
      title: `CA par mois — ${y}`,
      empty: false,
    }
  }

  if (g === 'semaine') {
    // jour équivalent : la semaine 52 semaines plus tôt (jours de semaine alignés).
    const prevMon = mode === 'equiv' ? addDays(refKey, -364) : prevYearKey(refKey, 'semaine')
    const labels: string[] = []
    const caCur: number[] = []
    const caPrev: number[] = []
    for (let i = 0; i < 7; i++) {
      if (!includedSet.has(i)) continue // jour de semaine exclu → retiré du graphe
      labels.push(WEEKDAYS[i])
      caCur.push(ca(addDays(refKey, i)))
      caPrev.push(ca(addDays(prevMon, i)))
    }
    return {
      kind: 'bar', labels, caCur, caPrev,
      curLabel: `Sem. du ${refKey.slice(8)}/${refKey.slice(5, 7)}`,
      prevLabel: `Sem. du ${prevMon.slice(8)}/${prevMon.slice(5, 7)}`,
      title: `CA par jour — ${refLabel('semaine', refKey)}`,
      empty: false,
    }
  }

  // Jour : pas de détail intra-période pertinent (le bloc « jour/veille » le couvre).
  return { kind: 'bar', labels: [], caCur: [], caPrev: [], curLabel: '', prevLabel: '', title: '', empty: true }
}

/** Résultat d'analyse sur une plage de dates libre. */
export interface FreeResult {
  /** Détail jour par jour de la plage, N vs N-1. */
  sub: BucketSeries
  /** CA total de la plage et de la même plage N-1 (à durée et jours égaux). */
  curRef: number
  prevRef: number
  deltaPct: number | null
}

/** Analyse sur une plage de dates libre [from, to], comparée à N-1 (jour équivalent ou date à date). */
export function buildFreeSeries(
  entries: DailyEntry[],
  from: string,
  to: string,
  mode: CompareMode = 'date',
  included: number[] = [0, 1, 2, 3, 4, 5, 6],
): FreeResult {
  const caByDate = new Map<string, number>()
  for (const e of entries) caByDate.set(e.date, (caByDate.get(e.date) ?? 0) + (e.revenue ?? 0))
  const ca = (iso: string) => Math.round(caByDate.get(iso) ?? 0)
  const includedSet = new Set(included)
  const labels: string[] = []
  const caCur: number[] = []
  const caPrev: number[] = []
  let curRef = 0
  let prevRef = 0
  if (from && to && from <= to) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (!includedSet.has(weekdayMon0(d))) continue
      const prev = mode === 'equiv' ? addDays(d, -364) : `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`
      const cur = ca(d)
      const pv = ca(prev)
      labels.push(`${d.slice(8)}/${d.slice(5, 7)}`)
      caCur.push(cur)
      caPrev.push(pv)
      curRef += cur
      prevRef += pv
    }
  }
  const fr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')
  return {
    sub: {
      kind: 'line',
      labels,
      caCur,
      caPrev,
      curLabel: 'Période',
      prevLabel: 'N-1',
      title: `CA par jour — du ${fr(from)} au ${fr(to)}`,
      empty: labels.length === 0,
    },
    curRef,
    prevRef,
    // Pas de CA N-1 mais du CA cette année → +100 % (du nouveau) ; rien des deux côtés → pas de badge.
    deltaPct: prevRef > 0 ? ((curRef - prevRef) / prevRef) * 100 : curRef > 0 ? 100 : null,
  }
}
