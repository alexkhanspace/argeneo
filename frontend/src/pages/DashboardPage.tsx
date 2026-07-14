import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Popover,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { errorMessage } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { getCost, listArticles, listRawMaterials } from '../api/costing'
import { listEmployees, listEtablissements } from '../api/iam'
import { getDay, listMonth, listMyEtablissements } from '../api/daily'
import {
  getHourlyWeather,
  getMonthWeather,
  getWeatherRange,
  summarizeHourly,
  weatherIcon,
  type HourWeather,
  type MonthWeather,
} from '../api/weather'
import { getHolidays } from '../api/holidays'
import { getMuslimDays, getJewishDays } from '../api/religiousCalendar'
import { getCuratedEvents } from '../api/observances'
import { getDayAnalysis, getDaysAnalysis, getTrend, type DayContextInput } from '../api/insights'
import { useSettings } from '../settings/SettingsContext'
import type { DailyEntry, MyEtablissement, Pnet } from '../api/types'

function formatEur(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 4,
  })
}

/** ISO YYYY-MM-DD à partir d'une Date locale (sans décalage de fuseau). */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

/** ISO YYYY-MM-DD à partir d'une Date locale. */
function toISO(d: Date): string {
  return toISODate(d)
}

/** Nouvelle Date décalée de `n` jours. */
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Date longue fr (ex. « dimanche 14 juin 2026 »). */
function formatDateLongFr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Nom long du jour de la semaine (ex. « dimanche »). */
function weekdayLongFr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long' })
}

/** Récap d'un jour avec son équivalent N-1 et la météo N-1. */
/** Un repère « l'an dernier » : date, CA, météo, événements et saisie du jour. */
interface DayRef {
  iso: string
  ca: number | null
  tMax: number | null
  events: string | null
  entry: DailyEntry | null
}

interface DayData {
  iso: string
  entry: DailyEntry | null
  tMaxJ: number | null
  ar: DayRef // même jour de semaine l'an dernier (référence prioritaire)
  aa: DayRef // même date l'an dernier
  analysis: string
  analysisLoading: boolean
  /** Détail météo horaire du jour (pour le popup au clic sur la météo). */
  hourly?: HourWeather[]
  /** Contexte envoyé à l'IA (réutilisé pour « Développer l'analyse »). */
  ctx?: DayContextInput
}

/** Carte-jour construite SANS l'appel IA (le contexte seul), pour batcher les analyses ensuite. */
interface DayContextResult {
  base: DayData
  ctx: DayContextInput
  mode: 'action' | 'bilan' | 'prep'
}

interface MarginRow {
  id: number
  code: string
  name: string
  pnet: number
  pvTtc: number | null
  marginHt: number | null
  coefficient: number | null
}

const MARGIN_COLUMNS: GridColDef<MarginRow>[] = [
  { field: 'code', headerName: 'Code', width: 90 },
  { field: 'name', headerName: 'Article', flex: 1, minWidth: 140 },
  {
    field: 'pnet',
    headerName: 'PNET HT',
    width: 110,
    type: 'number',
    valueFormatter: (v) => formatEur(v as number | null),
  },
  {
    field: 'pvTtc',
    headerName: 'PV TTC',
    width: 110,
    type: 'number',
    valueFormatter: (v) => formatEur(v as number | null),
  },
  {
    field: 'marginHt',
    headerName: 'Marge €',
    width: 110,
    type: 'number',
    valueFormatter: (v) => formatEur(v as number | null),
  },
  {
    field: 'coefficient',
    headerName: 'Coef',
    width: 90,
    type: 'number',
    valueFormatter: (v) => (v == null ? '—' : (v as number).toFixed(2)),
  },
]

export function DashboardPage() {
  const { baseline } = useSettings()
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState({ etabs: 0, articles: 0, employees: 0, materials: 0 })
  const [caJour, setCaJour] = useState<number | null>(null)
  const [margins, setMargins] = useState<MarginRow[]>([])
  const [recent, setRecent] = useState<DailyEntry[]>([])
  const [recentEtab, setRecentEtab] = useState<string | null>(null)

  // Cockpit du matin.
  const [etab, setEtab] = useState<MyEtablissement | null>(null)
  const [weather, setWeather] = useState<MonthWeather>({})
  const [today, setToday] = useState<DayData | null>(null)
  const [tomorrow, setTomorrow] = useState<DayData | null>(null)
  const [yesterday, setYesterday] = useState<DayData | null>(null)
  const [dayBefore, setDayBefore] = useState<DayData | null>(null)
  const [dayBeforeLoading, setDayBeforeLoading] = useState(false)
  // Analyses « développées » à la demande, par date (bouton « Développer »).
  const [details, setDetails] = useState<Record<string, { loading: boolean; text: string }>>({})
  // Popup météo horaire (clic sur la météo d'une carte).
  const [hourlyAnchor, setHourlyAnchor] = useState<{ el: HTMLElement; day: DayData } | null>(null)
  // Popup détail du CA N-1 (clic sur le chip « CA … » d'une ligne de référence).
  const [refDetail, setRefDetail] = useState<{ el: HTMLElement; label: string; r: DayRef } | null>(null)
  // Prévision longue (anticipation des prochaines semaines), chargée à la demande.
  const [longForecast, setLongForecast] = useState<
    { date: string; weeks: number; label: string; conseil: string }[] | null
  >(null)
  const [longLoading, setLongLoading] = useState(false)

  useEffect(() => {
    const today = toISODate(new Date())

    // KPI counts (chacun indépendant, tolérant aux erreurs).
    listEtablissements()
      .then((l) => setCounts((c) => ({ ...c, etabs: l.length })))
      .catch(() => undefined)
    listArticles()
      .then((l) => setCounts((c) => ({ ...c, articles: l.length })))
      .catch(() => undefined)
    listEmployees()
      .then((l) => setCounts((c) => ({ ...c, employees: l.length })))
      .catch(() => undefined)
    listRawMaterials()
      .then((l) => setCounts((c) => ({ ...c, materials: l.length })))
      .catch(() => undefined)

    // CA du jour (total) + activité récente du 1er établissement.
    listMyEtablissements()
      .then(async (etabs) => {
        const days = await Promise.all(
          etabs.map((e) => getDay(e.id, today).catch(() => null)),
        )
        const total = days.reduce((sum, d) => sum + (d?.revenue ?? 0), 0)
        setCaJour(total)

        if (etabs.length > 0) {
          const first = etabs[0]
          setRecentEtab(first.name)
          const to = new Date()
          const from = new Date()
          from.setDate(from.getDate() - 6)
          const entries = await listMonth(first.id, toISODate(from), toISODate(to)).catch(() => [])
          setRecent([...entries].sort((a, b) => b.date.localeCompare(a.date)))
        }
      })
      .catch((e) => setError(errorMessage(e)))

    // Marges des articles fabriqués.
    listArticles()
      .then(async (list) => {
        const fabriques = list.filter((a) => a.type === 'FABRIQUE')
        const codeById = new Map(fabriques.map((a) => [a.id, a.code]))
        const results = await Promise.all(
          fabriques.map((a) =>
            getCost(a.id)
              .then((p) => p)
              .catch(() => null),
          ),
        )
        const rows: MarginRow[] = results
          .filter((p): p is Pnet => p !== null)
          .map((p) => ({
            id: p.articleId,
            code: codeById.get(p.articleId) ?? String(p.articleId),
            name: p.articleName,
            pnet: p.unitCost,
            pvTtc: p.salePriceTtc ?? null,
            marginHt: p.marginHt ?? null,
            coefficient: p.coefficient ?? null,
          }))
        // Le DataGrid gère tri (par défaut sur le coef) et pagination : on envoie tout.
        setMargins(rows)
      })
      .catch(() => undefined)

    // KPI/marges/CA : une seule fois au montage (indépendants de l'axe de comparaison).
  }, [])

  // Cockpit du matin : (re)chargé au montage ET à chaque changement d'axe de comparaison,
  // pour que les analyses IA reflètent la comparaison choisie (le cache backend rend le retour gratuit).
  useEffect(() => {
    void loadCockpit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline])

  /** Construit le contexte d'une carte-jour (fetches météo/CA/événements) SANS appeler l'IA. */
  async function buildDayContext(
    e: MyEtablissement,
    iso: string,
    weatherMap: MonthWeather,
    eventsFor: (iso: string) => string | null,
    mode: 'action' | 'bilan' | 'prep',
  ): Promise<DayContextResult> {
    // Deux repères l'an dernier : AR = même jour de SEMAINE (−364 j), AA = même DATE (année −1).
    const refDate = new Date(iso + 'T00:00:00')
    const isoEquiv = toISO(addDays(refDate, -364)) // AR : jour équivalent (même jour de semaine)
    const isoSame = toISO(
      new Date(refDate.getFullYear() - 1, refDate.getMonth(), refDate.getDate()),
    ) // AA : même date
    const [entry, entryEquiv, entrySame, wxN1, hourlyJ] = await Promise.all([
      getDay(e.id, iso).catch(() => null),
      getDay(e.id, isoEquiv).catch(() => null),
      getDay(e.id, isoSame).catch(() => null),
      e.latitude != null && e.longitude != null
        ? getWeatherRange(e.latitude, e.longitude, isoSame, isoEquiv).catch(() => ({}) as MonthWeather)
        : Promise.resolve({} as MonthWeather),
      e.latitude != null && e.longitude != null
        ? getHourlyWeather(e.latitude, e.longitude, iso).catch(() => [] as HourWeather[])
        : Promise.resolve([] as HourWeather[]),
    ])
    const wxJ = weatherMap[iso]
    const wxAr = wxN1[isoEquiv]
    const ar: DayRef = { iso: isoEquiv, ca: entryEquiv?.revenue ?? null, tMax: wxAr?.tMax ?? null, events: eventsFor(isoEquiv), entry: entryEquiv }
    const aa: DayRef = { iso: isoSame, ca: entrySame?.revenue ?? null, tMax: wxN1[isoSame]?.tMax ?? null, events: eventsFor(isoSame), entry: entrySame }
    const tMaxJ = wxJ?.tMax ?? null

    // Événements des tout prochains jours → l'IA peut repérer une VEILLE de férié/pont et anticiper l'affluence.
    const nextIso1 = toISO(addDays(refDate, 1))
    const nextIso2 = toISO(addDays(refDate, 2))
    const nextParts: string[] = []
    const en1 = eventsFor(nextIso1)
    if (en1) nextParts.push(`demain (${nextIso1}) : ${en1}`)
    const en2 = eventsFor(nextIso2)
    if (en2) nextParts.push(`après-demain (${nextIso2}) : ${en2}`)
    const eventsNext = nextParts.length ? nextParts.join(' ; ') : null

    const day: DayContextInput = {
      date: iso,
      weekday: weekdayLongFr(iso),
      revenue: entry?.revenue ?? null,
      clientCount: entry?.clientCount ?? null,
      tMax: tMaxJ,
      tMaxN1: ar.tMax, // météo l'an dernier = même jour de semaine (priorité)
      events: eventsFor(iso),
      caN1Date: aa.ca, // AA : même date
      caN1Equiv: ar.ca, // AR : jour équivalent (même jour de semaine)
      noteProd: entry?.noteProd ?? null,
      noteSale: entry?.noteSale ?? null,
      noteProdN1: ar.entry?.noteProd ?? null, // mots du jour du même jour N-1
      noteSaleN1: ar.entry?.noteSale ?? null,
      eventsAr: eventsFor(isoEquiv), // événements du même jour de semaine N-1
      eventsAa: eventsFor(isoSame), // événements de la même date N-1
      sky: wxJ ? weatherIcon(wxJ.code).label : null, // condition du ciel (pluie/soleil…) du jour
      skyN1: wxAr ? weatherIcon(wxAr.code).label : null, // condition du même jour N-1
      hourly: summarizeHourly(hourlyJ) || null, // résumé horaire (matin/midi/aprem/soir)
      eventsNext, // événements des prochains jours (veille de férié/pont)
    }

    const base: DayData = {
      iso, entry, tMaxJ, ar, aa, analysis: '', analysisLoading: false, hourly: hourlyJ, ctx: day,
    }
    return { base, ctx: day, mode }
  }

  /** Contexte + analyse IA d'UNE journée (appel unitaire) — utilisé pour le chargement à la demande. */
  async function buildDayData(
    e: MyEtablissement,
    iso: string,
    weatherMap: MonthWeather,
    eventsFor: (iso: string) => string | null,
    mode: 'action' | 'bilan' | 'prep',
  ): Promise<DayData> {
    const { base, ctx } = await buildDayContext(e, iso, weatherMap, eventsFor, mode)
    try {
      const res = await getDayAnalysis({
        etablissement: e.name,
        description: e.description,
        location: e.address,
        mode,
        baseline,
        day: ctx,
      })
      return { ...base, analysis: res.analysis }
    } catch (err) {
      return { ...base, analysis: errorMessage(err) }
    }
  }

  async function loadCockpit() {
    let etabs: MyEtablissement[]
    try {
      etabs = await listMyEtablissements()
    } catch {
      return
    }
    if (etabs.length === 0) return
    const e = etabs[0]
    setEtab(e)

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const todayIso = toISO(now)
    const yIso = toISO(addDays(now, -1))
    const tIso = toISO(addDays(now, 1))

    // Météo du mois courant (couvre J-1/J/J+1).
    const weatherMap: MonthWeather =
      e.latitude != null && e.longitude != null
        ? await getMonthWeather(e.latitude, e.longitude, year, month).catch((): MonthWeather => ({}))
        : {}
    setWeather(weatherMap)

    // Maps d'événements sur 2 ANS (année courante + N-1) : les jours de référence (AR/AA)
    // tombent l'an dernier, et les fêtes mobiles (Mères/Pères, Pâques…) y diffèrent.
    const [holidays, muslim, jewish, fetes, holidaysN1, muslimN1, jewishN1, fetesN1] = await Promise.all([
      getHolidays(year).catch((): Record<string, string> => ({})),
      getMuslimDays(year, month).catch((): Record<string, string> => ({})),
      getJewishDays(year, month).catch((): Record<string, string> => ({})),
      Promise.resolve(getCuratedEvents(year)),
      getHolidays(year - 1).catch((): Record<string, string> => ({})),
      getMuslimDays(year - 1, month).catch((): Record<string, string> => ({})),
      getJewishDays(year - 1, month).catch((): Record<string, string> => ({})),
      Promise.resolve(getCuratedEvents(year - 1)),
    ])
    // Cartes fusionnées par date ISO complète (clé YYYY-MM-DD → pas de collision entre années).
    const allHolidays = { ...holidaysN1, ...holidays }
    const allMuslim = { ...muslimN1, ...muslim }
    const allJewish = { ...jewishN1, ...jewish }
    const allFetes = { ...fetesN1, ...fetes }
    const eventsFor = (iso: string): string | null => {
      const parts = [allHolidays[iso], allMuslim[iso] || allJewish[iso], allFetes[iso]].filter(Boolean)
      return parts.length > 0 ? parts.join(' · ') : null
    }

    // Squelettes en chargement pour afficher les cartes immédiatement.
    const emptyRef = (): DayRef => ({ iso: '', ca: null, tMax: null, events: null, entry: null })
    const skeleton = (iso: string): DayData => ({
      iso, entry: null, tMaxJ: null, ar: emptyRef(), aa: emptyRef(), analysis: '', analysisLoading: true,
    })
    setToday(skeleton(todayIso))
    setYesterday(skeleton(yIso))
    setTomorrow(skeleton(tIso))

    // 1) Construire les 3 contextes (fetches météo/CA/événements) sans appeler l'IA.
    const [c0, c1, c2] = await Promise.all([
      buildDayContext(e, todayIso, weatherMap, eventsFor, 'action'),
      buildDayContext(e, yIso, weatherMap, eventsFor, 'bilan'),
      buildDayContext(e, tIso, weatherMap, eventsFor, 'prep'),
    ])
    const contexts = [c0, c1, c2]

    // 2) UN seul appel IA pour les 3 jours (batché + mis en cache côté backend).
    const analyses: Record<string, string> = {}
    try {
      const res = await getDaysAnalysis({
        etablissement: e.name,
        description: e.description,
        location: e.address,
        baseline,
        items: contexts.map((c) => ({ mode: c.mode, day: c.ctx })),
      })
      for (const a of res.analyses) analyses[a.date] = a.analysis
    } catch (err) {
      const msg = errorMessage(err)
      for (const c of contexts) analyses[c.base.iso] = msg
    }

    const attach = (c: DayContextResult): DayData => ({
      ...c.base,
      analysis: analyses[c.base.iso] ?? '',
      analysisLoading: false,
    })
    setToday(attach(c0))
    setYesterday(attach(c1))
    setTomorrow(attach(c2))
  }

  async function loadDayBefore() {
    if (!etab) return
    setDayBeforeLoading(true)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const dbIso = toISO(addDays(now, -2))
    const [holidays, muslim, jewish, fetes, holidaysN1, muslimN1, jewishN1, fetesN1] = await Promise.all([
      getHolidays(year).catch((): Record<string, string> => ({})),
      getMuslimDays(year, month).catch((): Record<string, string> => ({})),
      getJewishDays(year, month).catch((): Record<string, string> => ({})),
      Promise.resolve(getCuratedEvents(year)),
      getHolidays(year - 1).catch((): Record<string, string> => ({})),
      getMuslimDays(year - 1, month).catch((): Record<string, string> => ({})),
      getJewishDays(year - 1, month).catch((): Record<string, string> => ({})),
      Promise.resolve(getCuratedEvents(year - 1)),
    ])
    const allHolidays = { ...holidaysN1, ...holidays }
    const allMuslim = { ...muslimN1, ...muslim }
    const allJewish = { ...jewishN1, ...jewish }
    const allFetes = { ...fetesN1, ...fetes }
    const eventsFor = (iso: string): string | null => {
      const parts = [allHolidays[iso], allMuslim[iso] || allJewish[iso], allFetes[iso]].filter(Boolean)
      return parts.length > 0 ? parts.join(' · ') : null
    }
    const data = await buildDayData(etab, dbIso, weather, eventsFor, 'bilan')
    setDayBefore(data)
    setDayBeforeLoading(false)
  }

  /** Prévision longue : balaie ~6 semaines, repère les jours à enjeu et demande des conseils. */
  async function loadLongForecast() {
    if (!etab) return
    setLongLoading(true)
    try {
      const now = new Date()
      const horizon = 42 // 6 semaines
      // Cartes d'événements couvrant l'horizon (mois courant + 2 suivants).
      const months = [0, 1, 2].map((k) => {
        const d = new Date(now.getFullYear(), now.getMonth() + k, 1)
        return { y: d.getFullYear(), m: d.getMonth() }
      })
      // Années de l'horizon + années N-1 (pour comparer chaque jour à la MÊME date l'an dernier).
      const horizonYears = [...new Set(months.map((mm) => mm.y))]
      const years = [...new Set([...horizonYears, ...horizonYears.map((y) => y - 1)])]
      const holidaysByYear: Record<number, Record<string, string>> = {}
      const fetesByYear: Record<number, Record<string, string>> = {}
      await Promise.all(
        years.map(async (y) => {
          holidaysByYear[y] = await getHolidays(y).catch((): Record<string, string> => ({}))
          fetesByYear[y] = getCuratedEvents(y)
        }),
      )
      // Mois de l'horizon + les mêmes mois l'an dernier (fêtes musulmanes/juives, à date mobile).
      const allMonths = [...months, ...months.map((mm) => ({ y: mm.y - 1, m: mm.m }))]
      const muslimMaps = await Promise.all(
        allMonths.map((mm) => getMuslimDays(mm.y, mm.m).catch((): Record<string, string> => ({}))),
      )
      const jewishMaps = await Promise.all(
        allMonths.map((mm) => getJewishDays(mm.y, mm.m).catch((): Record<string, string> => ({}))),
      )
      const muslim: Record<string, string> = Object.assign({}, ...muslimMaps)
      const jewish: Record<string, string> = Object.assign({}, ...jewishMaps)
      const eventsFor = (iso: string): string | null => {
        const y = Number(iso.slice(0, 4))
        const parts = [holidaysByYear[y]?.[iso], muslim[iso] || jewish[iso], fetesByYear[y]?.[iso]].filter(Boolean)
        return parts.length ? parts.join(' · ') : null
      }

      // Même date l'an dernier (année −1, même mois/jour) — repère de la même fête.
      const sameDateN1 = (iso: string): string => {
        const d = new Date(iso + 'T00:00:00')
        return toISO(new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()))
      }
      // CA réel de la même date l'an dernier sur toute la fenêtre, en UNE requête.
      const firstIso = toISO(addDays(now, 1))
      const lastIso = toISO(addDays(now, horizon))
      const caN1ByDate: Record<string, number> = {}
      try {
        const n1Entries = await listMonth(etab.id, sameDateN1(firstIso), sameDateN1(lastIso))
        for (const en of n1Entries) {
          if (en.revenue != null) caN1ByDate[en.date] = en.revenue
        }
      } catch {
        // Pas de N-1 disponible : la prévision reste basée sur météo + événements.
      }

      const days: DayContextInput[] = []
      for (let i = 1; i <= horizon; i++) {
        const iso = toISO(addDays(now, i))
        const isoN1 = sameDateN1(iso)
        const w = weather[iso]
        days.push({
          date: iso,
          weekday: weekdayLongFr(iso),
          tMax: w?.tMax ?? null,
          sky: w ? weatherIcon(w.code).label : null,
          events: eventsFor(iso),
          eventsAa: eventsFor(isoN1), // événements de la même date l'an dernier (même fête)
          caN1Date: caN1ByDate[isoN1] ?? null, // CA réel de la même date l'an dernier
        })
      }
      const res = await getTrend({
        etablissement: etab.name,
        description: etab.description,
        location: etab.address,
        periode: 'prochaines semaines',
        baseline,
        days,
      })
      const out = res.days
        .map((a) => {
          const dt = new Date(a.date + 'T00:00:00')
          const diffDays = Math.round((dt.getTime() - now.getTime()) / 86400000)
          return {
            date: a.date,
            weeks: Math.max(0, Math.round(diffDays / 7)),
            label: formatDateLongFr(a.date),
            conseil: a.conseil,
          }
        })
        .sort((a, b) => a.date.localeCompare(b.date))
      setLongForecast(out)
    } catch {
      setLongForecast([])
    } finally {
      setLongLoading(false)
    }
  }

  // Bande météo 3 jours autour d'une date de référence (offsets -1/0/+1).
  // Météo du jour de la carte (J) + repères an dernier : même jour de semaine (AR) et même date (AA).
  function renderRefs(day: DayData) {
    const jCa = day.entry?.revenue ?? null
    const wj = weather[day.iso]
    const refRow = (label: string, r: DayRef) => {
      const delta = jCa != null && r.ca != null && r.ca !== 0 ? ((jCa - r.ca) / r.ca) * 100 : null
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 118 }}>
            {label}
            {r.iso ? ` · ${formatDateFr(r.iso)}` : ''}
          </Typography>
          <Typography variant="body2">{r.tMax != null ? `~${Math.round(r.tMax)}°` : '—'}</Typography>
          <Chip
            size="small"
            variant="outlined"
            label={`CA ${formatEur(r.ca)}`}
            onClick={r.entry ? (e) => setRefDetail({ el: e.currentTarget, label, r }) : undefined}
            sx={r.entry ? { cursor: 'pointer' } : undefined}
          />
          {delta != null && (
            <Typography
              variant="body2"
              sx={{ fontWeight: 'bold' }}
              color={delta >= 0 ? 'success.main' : 'error.main'}
            >
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)} %
            </Typography>
          )}
          {r.events && (
            <Typography variant="caption" sx={{ color: '#1565c0' }}>
              🎉 {r.events}
            </Typography>
          )}
        </Stack>
      )
    }
    return (
      <Box>
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 118 }}>
              Météo du jour (J)
            </Typography>
            <Box
              component="span"
              onClick={
                day.hourly && day.hourly.length > 0
                  ? (e) => setHourlyAnchor({ el: e.currentTarget, day })
                  : undefined
              }
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                cursor: day.hourly && day.hourly.length > 0 ? 'pointer' : 'default',
                px: day.hourly && day.hourly.length > 0 ? 0.5 : 0,
                borderRadius: 1,
                '&:hover': day.hourly && day.hourly.length > 0 ? { bgcolor: 'action.hover' } : undefined,
              }}
            >
              <Typography variant="h6" component="span" sx={{ lineHeight: 1 }}>
                {wj ? weatherIcon(wj.code).emoji : '—'}
              </Typography>
              <Typography variant="body2">{day.tMaxJ != null ? `~${Math.round(day.tMaxJ)}°` : '—'}</Typography>
              {day.hourly && day.hourly.length > 0 && (
                <Typography variant="caption" color="primary">
                  détail ▾
                </Typography>
              )}
            </Box>
            {day.ctx?.events && (
              <Typography variant="caption" sx={{ color: '#1565c0' }}>
                🎉 {day.ctx.events}
              </Typography>
            )}
          </Stack>
          {refRow('Même jour N-1', day.ar)}
          {refRow('Même date N-1', day.aa)}
        </Stack>
        {(day.ar.entry?.noteProd || day.ar.entry?.noteSale) && (
          <Box sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Mots du jour (même jour N-1) :
            </Typography>
            {day.ar.entry?.noteProd && (
              <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                🥖 {day.ar.entry.noteProd}
              </Typography>
            )}
            {day.ar.entry?.noteSale && (
              <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                🛒 {day.ar.entry.noteSale}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    )
  }

  // Récap court d'un jour (CA, casse, mots du jour).
  function renderRecap(entry: DailyEntry | null) {
    return (
      <Stack spacing={0.5} sx={{ overflowWrap: 'anywhere' }}>
        <Typography variant="body2">CA : {formatEur(entry?.revenue)}</Typography>
        <Typography variant="body2">
          Clients : {entry?.clientCount ?? '—'}
          {entry?.revenue != null && entry?.clientCount != null && entry.clientCount > 0
            ? ` — ticket moyen ${formatEur(entry.revenue / entry.clientCount)}`
            : ''}
        </Typography>
        <Typography variant="body2">
          Perte :{' '}
          {entry?.losses && entry.losses.length > 0
            ? entry.losses.map((l) => `${l.articleName} ×${l.quantity}`).join(', ')
            : '—'}
        </Typography>
        {entry?.noteProd && <Typography variant="body2">🥖 {entry.noteProd}</Typography>}
        {entry?.noteSale && <Typography variant="body2">🛒 {entry.noteSale}</Typography>}
      </Stack>
    )
  }


  // Bloc analyse IA (spinner ou texte encadré).
  function renderAnalysis(loading: boolean, analysis: string) {
    // Met en valeur un verdict de performance en tête (mode bilan) ; sinon rendu normal.
    const m = analysis.match(/^\s*(.{0,40}?[.!])\s*([\s\S]*)$/)
    const head = m ? m[1] : ''
    const rest = m ? m[2] : ''
    const low = head.toLowerCase()
    let verdictColor: string | null = null
    if (/bonne|très bonne|excellente|solide|belle|record/.test(low)) verdictColor = 'success.main'
    else if (/déce|mauvaise|faible|morose|en baisse|difficile/.test(low)) verdictColor = 'error.main'
    else if (/correcte|moyenne|mitigée|stable/.test(low)) verdictColor = 'warning.main'

    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          🔮 Analyse IA
        </Typography>
        {loading ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Analyse…
            </Typography>
          </Stack>
        ) : (
          <Typography
            variant="body2"
            sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
          >
            {verdictColor ? (
              <>
                <Box component="span" sx={{ fontWeight: 700, color: verdictColor }}>
                  {head}
                </Box>{' '}
                {rest}
              </>
            ) : (
              analysis
            )}
          </Typography>
        )}
      </Box>
    )
  }

  // Demande à l'IA une analyse plus développée pour un jour (réutilise son contexte).
  async function develop(day: DayData, mode: 'action' | 'bilan' | 'prep') {
    if (!etab || !day.ctx) return
    setDetails((m) => ({ ...m, [day.iso]: { loading: true, text: '' } }))
    try {
      const res = await getDayAnalysis({
        etablissement: etab.name,
        description: etab.description,
        location: etab.address,
        mode,
        baseline,
        detail: true,
        day: day.ctx,
      })
      setDetails((m) => ({ ...m, [day.iso]: { loading: false, text: res.analysis } }))
    } catch (e) {
      setDetails((m) => ({ ...m, [day.iso]: { loading: false, text: errorMessage(e) } }))
    }
  }

  /** Analyse courte + bouton « Développer » (et le texte développé une fois chargé). */
  function analysisBlock(day: DayData, mode: 'action' | 'bilan' | 'prep') {
    const det = details[day.iso]
    return (
      <Box>
        {renderAnalysis(day.analysisLoading, day.analysis)}
        {!day.analysisLoading && day.ctx && (
          det?.text ? (
            <Typography
              variant="body2"
              sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
            >
              {det.text}
            </Typography>
          ) : (
            <Button
              size="small"
              variant="text"
              onClick={() => void develop(day, mode)}
              disabled={det?.loading}
              startIcon={det?.loading ? <CircularProgress size={14} /> : <AutoAwesomeIcon fontSize="small" />}
              sx={{ mt: 0.5 }}
            >
              {det?.loading ? 'Analyse en cours…' : "Développer l'analyse"}
            </Button>
          )
        )}
      </Box>
    )
  }

  const kpis: Array<{ value: string; label: string; accent?: boolean }> = [
    { value: String(counts.etabs), label: 'Établissements' },
    { value: String(counts.articles), label: 'Articles' },
    { value: String(counts.employees), label: 'Employés' },
    { value: String(counts.materials), label: 'Matières premières' },
    { value: caJour == null ? '…' : formatEur(caJour), label: 'CA du jour (TTC, total)', accent: true },
  ]

  return (
    <>
      <PageHeader title="Tableau de bord" />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 2,
          mb: 3,
        }}
      >
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 'bold',
                  // Police compacte sur mobile pour que le montant ne déborde pas de la carte.
                  fontSize: { xs: '1.35rem', sm: '2.125rem' },
                  lineHeight: 1.15,
                }}
                color={k.accent ? 'primary' : 'text.primary'}
              >
                {k.value}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: { xs: '0.78rem', sm: '0.875rem' } }}
              >
                {k.label}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {etab && today && yesterday && (() => {
        // Après 16h, « Demain » passe au-dessus d'« Aujourd'hui » (on prépare le lendemain).
        const afterCutoff = new Date().getHours() >= 16
        const order: Array<'tomorrow' | 'today' | 'yesterday'> = afterCutoff
          ? ['tomorrow', 'today', 'yesterday']
          : ['today', 'tomorrow', 'yesterday']

        const todayCard = (
          <Card key="today" sx={{ borderTop: 3, borderColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="h2" gutterBottom>
                Aujourd'hui — {formatDateLongFr(today.iso)}
              </Typography>
              <Stack spacing={1.5}>
                {renderRecap(today.entry)}
                {renderRefs(today)}
                {analysisBlock(today, 'action')}
              </Stack>
            </CardContent>
          </Card>
        )

        // Demain (J+1) — préparation : pas de CA (jour futur), on montre météo + repère N-1 + conseil.
        const tomorrowCard = tomorrow ? (
          <Card key="tomorrow" sx={{ borderTop: 3, borderColor: 'success.main' }}>
            <CardContent>
              <Typography variant="h2" gutterBottom>
                Demain — {formatDateLongFr(tomorrow.iso)}
              </Typography>
              <Stack spacing={1.5}>
                {renderRefs(tomorrow)}
                {analysisBlock(tomorrow, 'prep')}
              </Stack>
            </CardContent>
          </Card>
        ) : null

        const yesterdayCard = (
          <Card key="yesterday" sx={{ borderTop: 3, borderColor: 'secondary.main' }}>
            <CardContent>
              <Typography variant="h2" gutterBottom>
                Hier — {formatDateLongFr(yesterday.iso)}
              </Typography>
              <Stack spacing={1.5}>
                {renderRecap(yesterday.entry)}
                {renderRefs(yesterday)}
                {analysisBlock(yesterday, 'bilan')}

                {dayBefore ? (
                  <Box>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Avant-hier — {formatDateLongFr(dayBefore.iso)}
                    </Typography>
                    <Stack spacing={1.5}>
                      {renderRecap(dayBefore.entry)}
                      {renderRefs(dayBefore)}
                      {analysisBlock(dayBefore, 'bilan')}
                    </Stack>
                  </Box>
                ) : (
                  <Button
                    variant="outlined"
                    onClick={() => void loadDayBefore()}
                    disabled={dayBeforeLoading}
                    startIcon={dayBeforeLoading ? <CircularProgress size={16} /> : undefined}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Analyser aussi avant-hier (J-2)
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        )

        const cards = { today: todayCard, tomorrow: tomorrowCard, yesterday: yesterdayCard }
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 3, mb: 3 }}>
            {order.map((k) => cards[k])}
          </Box>
        )
      })()}

      {/* Prévision longue — anticipation des prochaines semaines */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h2" gutterBottom>
            Prévision longue — prochaines semaines
          </Typography>
          {longForecast === null ? (
            <Button
              variant="outlined"
              onClick={() => void loadLongForecast()}
              disabled={longLoading || !etab}
              startIcon={longLoading ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
            >
              {longLoading ? 'Analyse…' : 'Voir la prévision longue'}
            </Button>
          ) : longForecast.length === 0 ? (
            <Typography color="text.secondary">
              Rien de particulier à anticiper dans les prochaines semaines.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {longForecast.map((f) => (
                <Stack
                  key={f.date}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
                >
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={f.weeks <= 0 ? 'cette semaine' : `dans ${f.weeks} sem.`}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {f.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    — {f.conseil}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Marges (articles fabriqués)
            </Typography>
            {margins.length === 0 ? (
              <Typography color="text.secondary">Aucune donnée de marge disponible.</Typography>
            ) : (
              <Box sx={{ height: 420, width: '100%' }}>
                <DataGrid
                  rows={margins}
                  columns={MARGIN_COLUMNS}
                  showToolbar
                  disableRowSelectionOnClick
                  sortingOrder={['asc', 'desc', null]}
                  pageSizeOptions={[10, 25, 50]}
                  initialState={{
                    pagination: { paginationModel: { pageSize: 10 } },
                    sorting: { sortModel: [{ field: 'coefficient', sort: 'desc' }] },
                  }}
                  sx={{ border: 0 }}
                />
              </Box>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Activité récente
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {recentEtab ? `7 derniers jours — ${recentEtab}` : 'Aucun établissement.'}
            </Typography>
            {recent.length === 0 ? (
              <Typography color="text.secondary">
                Aucune saisie sur les 7 derniers jours.
              </Typography>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table sx={{ minWidth: 480 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Jour</TableCell>
                      <TableCell>CA (TTC)</TableCell>
                      <TableCell>Perte</TableCell>
                      <TableCell>Mot du jour</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recent.map((r) => (
                      <TableRow key={r.date}>
                        <TableCell>{formatDateFr(r.date)}</TableCell>
                        <TableCell>{formatEur(r.revenue)}</TableCell>
                        <TableCell>
                          {(() => {
                            const parts: string[] = []
                            if (r.losses && r.losses.length > 0)
                              parts.push(`${r.losses.length} article${r.losses.length > 1 ? 's' : ''}`)
                            // Perte saisie directement en valeur (sans article détaillé).
                            if (r.lossAmount != null && r.lossAmount > 0) parts.push(formatEur(r.lossAmount))
                            return parts.length > 0 ? parts.join(' + ') : '—'
                          })()}
                        </TableCell>
                        <TableCell>{r.noteProd || r.noteSale || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Popup météo heure par heure (clic sur la météo d'une carte) */}
      <Popover
        open={Boolean(hourlyAnchor)}
        anchorEl={hourlyAnchor?.el}
        onClose={() => setHourlyAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, maxWidth: 360 }}>
          <Typography variant="subtitle2" gutterBottom>
            Météo heure par heure{hourlyAnchor ? ` — ${formatDateLongFr(hourlyAnchor.day.iso)}` : ''}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              columnGap: 2,
              rowGap: 0.25,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            {(hourlyAnchor?.day.hourly ?? [])
              .filter((h) => h.hour >= 5 && h.hour <= 23)
              .map((h) => (
                <Stack key={h.hour} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ minWidth: 30 }}>
                    {String(h.hour).padStart(2, '0')}h
                  </Typography>
                  <Box component="span">{weatherIcon(h.code).emoji}</Box>
                  <Typography variant="caption">{h.temp != null ? `${Math.round(h.temp)}°` : '—'}</Typography>
                  {h.precipProb != null && h.precipProb >= 30 && (
                    <Typography variant="caption" color="primary">
                      {h.precipProb}%
                    </Typography>
                  )}
                </Stack>
              ))}
          </Box>
        </Box>
      </Popover>

      {/* Popup détail du jour N-1 (clic sur le chip « CA … » d'une ligne de référence) */}
      <Popover
        open={Boolean(refDetail)}
        anchorEl={refDetail?.el}
        onClose={() => setRefDetail(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {refDetail && (
          <Box sx={{ p: 1.5, minWidth: 220, maxWidth: 320 }}>
            <Typography variant="subtitle2" gutterBottom>
              {refDetail.label}
              {refDetail.r.iso ? ` — ${formatDateLongFr(refDetail.r.iso)}` : ''}
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                CA : <strong>{formatEur(refDetail.r.entry?.revenue)}</strong>
              </Typography>
              <Typography variant="body2">
                Clients : {refDetail.r.entry?.clientCount ?? '—'}
                {refDetail.r.entry?.revenue != null && refDetail.r.entry?.clientCount
                  ? ` — ticket moyen ${formatEur(refDetail.r.entry.revenue / refDetail.r.entry.clientCount)}`
                  : ''}
              </Typography>
              <Typography variant="body2">
                Perte :{' '}
                {refDetail.r.entry?.lossAmount != null ? formatEur(refDetail.r.entry.lossAmount) : '—'}
              </Typography>
              <Typography variant="body2">
                Météo : {refDetail.r.tMax != null ? `~${Math.round(refDetail.r.tMax)}°` : '—'}
              </Typography>
              {refDetail.r.events && (
                <Typography variant="body2" sx={{ color: '#1565c0' }}>
                  🎉 {refDetail.r.events}
                </Typography>
              )}
              {refDetail.r.entry?.noteProd && (
                <Typography variant="caption" color="text.secondary">
                  Prod : {refDetail.r.entry.noteProd}
                </Typography>
              )}
              {refDetail.r.entry?.noteSale && (
                <Typography variant="caption" color="text.secondary">
                  Vente : {refDetail.r.entry.noteSale}
                </Typography>
              )}
            </Stack>
          </Box>
        )}
      </Popover>
    </>
  )
}
