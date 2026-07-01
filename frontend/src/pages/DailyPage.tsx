import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Popover,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import LayersIcon from '@mui/icons-material/Layers'
import Tooltip from '@mui/material/Tooltip'
import { errorMessage } from '../api/client'
import {
  getHourlyWeather,
  getMonthWeather,
  getWeatherRange,
  weatherIcon,
  type HourWeather,
  type MonthWeather,
} from '../api/weather'
import { getHolidays, type Holidays } from '../api/holidays'
import { getMuslimDays, getJewishDays } from '../api/religiousCalendar'
import { getCuratedEvents } from '../api/observances'
import { getTrend, type DayContextInput } from '../api/insights'
import { useSettings } from '../settings/SettingsContext'
import { getDay, listMonth, listMyEtablissements, saveDay, scanTicket } from '../api/daily'
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner'
import { listArticles } from '../api/costing'
import type { Article, DailyEntry, MyEtablissement } from '../api/types'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'

/** Date longue en français à partir d'un ISO YYYY-MM-DD. */
function formatLongDate(iso: string): string {
  const [yy, mm, dd] = iso.split('-').map(Number)
  return new Date(yy, mm - 1, dd).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatEur(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 4,
  })
}

/** Petite flèche de progression du CA d'un jour vs le même jour de semaine l'an dernier. */
function DayTrend({ delta }: { delta: number | null }) {
  if (delta == null) return null
  const flat = Math.abs(delta) < 2
  const up = delta >= 0
  const Icon = flat ? TrendingFlatIcon : up ? TrendingUpIcon : TrendingDownIcon
  const color = flat ? 'text.disabled' : up ? 'success.main' : 'error.main'
  return (
    <Tooltip title={`vs même jour l'an dernier : ${up && !flat ? '+' : ''}${delta.toFixed(0)} %`}>
      <Stack direction="row" sx={{ alignItems: 'center', color, gap: 0.1, flexShrink: 0 }}>
        <Icon sx={{ fontSize: '0.95rem' }} />
        <Typography
          component="span"
          sx={{ fontWeight: 700, fontSize: '0.6rem', lineHeight: 1, display: { xs: 'none', sm: 'block' } }}
        >
          {up && !flat ? '+' : ''}
          {delta.toFixed(0)}%
        </Typography>
      </Stack>
    </Tooltip>
  )
}

/** Progression d'un jour vs le même jour de semaine N-1 (J-364), ou null si incomparable. */
function dayTrendPct(
  entries: Record<string, DailyEntry>,
  prevEntries: Record<string, DailyEntry>,
  date: Date,
): number | null {
  const iso = toISODate(date)
  const prevIso = toISODate(addDays(date, -364))
  const cur = entries[iso]?.revenue ?? null
  const prev = prevEntries[prevIso]?.revenue ?? null
  return cur != null && prev != null && prev > 0 ? ((cur - prev) / prev) * 100 : null
}

/** ISO YYYY-MM-DD à partir d'une Date locale (sans décalage de fuseau). */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoFor(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

export function DailyPage() {
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [etabId, setEtabId] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Mois affiché.
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-based
  const [entries, setEntries] = useState<Record<string, DailyEntry>>({})

  // Articles (pour le sélecteur de casse).
  const [articles, setArticles] = useState<Article[]>([])

  // Jour sélectionné + éditeur.
  type LossRow = { articleId: number | null; quantity: string }
  const [selected, setSelected] = useState<string | null>(null)
  const [day, setDay] = useState<DailyEntry | null>(null)
  const [revenueInput, setRevenueInput] = useState('')
  const [clientCountInput, setClientCountInput] = useState('')
  const [lossRows, setLossRows] = useState<LossRow[]>([])
  const [lossAmountInput, setLossAmountInput] = useState('')
  const [noteProdInput, setNoteProdInput] = useState('')
  const [noteSaleInput, setNoteSaleInput] = useState('')
  const [editorError, setEditorError] = useState<string | null>(null)
  const [editorOk, setEditorOk] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [ticketScanning, setTicketScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const ticketFileRef = useRef<HTMLInputElement | null>(null)
  const monthPickerRef = useRef<HTMLInputElement | null>(null)
  const ticketGlobalRef = useRef<HTMLInputElement | null>(null)

  // Scan « global » : l'IA lit la date du ticket et ouvre le bon jour, sans sélection préalable.
  const onScanTicketGlobal = async (file: File | undefined) => {
    if (!file || etabId == null) return
    setScanMsg(null)
    setTicketScanning(true)
    try {
      const r = await scanTicket(etabId, file)
      const date = r.date ?? selected
      if (!date) {
        setScanMsg(
          "Date non détectée sur le ticket. Ouvre d'abord le jour concerné, ou réessaie avec une photo plus nette.",
        )
        return
      }
      const d = await getDay(etabId, date)
      setSelected(date)
      setDay(d)
      setLossRows((d.losses ?? []).map((l) => ({ articleId: l.articleId, quantity: String(l.quantity) })))
      setLossAmountInput(d.lossAmount == null ? '' : String(d.lossAmount))
      setNoteProdInput(d.noteProd ?? '')
      setNoteSaleInput(d.noteSale ?? '')
      setRevenueInput(r.revenue != null ? String(r.revenue) : d.revenue == null ? '' : String(d.revenue))
      setClientCountInput(
        r.clientCount != null ? String(r.clientCount) : d.clientCount == null ? '' : String(d.clientCount),
      )
      setEditorError(null)
      setEditorOk(`Ticket Z lu pour le ${date}. Vérifie puis enregistre.`)
    } catch (e) {
      setScanMsg(errorMessage(e))
    } finally {
      setTicketScanning(false)
    }
  }

  const onScanTicket = async (file: File | undefined) => {
    if (!file || etabId == null) return
    setEditorError(null)
    setEditorOk(null)
    setTicketScanning(true)
    try {
      const r = await scanTicket(etabId, file)
      if (r.revenue != null) setRevenueInput(String(r.revenue))
      if (r.clientCount != null) setClientCountInput(String(r.clientCount))
      if (r.revenue == null && r.clientCount == null) {
        setEditorError('Ticket Z non reconnu — réessaie avec une photo plus nette, ou saisis à la main.')
      } else {
        setEditorOk('Ticket Z lu — CA et clients pré-remplis. Vérifie puis enregistre.')
      }
    } catch (e) {
      setEditorError(errorMessage(e))
    } finally {
      setTicketScanning(false)
    }
  }

  const todayIso = toISODate(now)
  const selectedEtab = etabs.find((e) => e.id === etabId) ?? null
  const can = (code: string) => selectedEtab?.permissions.includes(code) ?? false

  // Chargement des établissements.
  useEffect(() => {
    listMyEtablissements()
      .then((list) => {
        setEtabs(list)
        if (list.length > 0) setEtabId(list[0].id)
      })
      .catch((e) => setLoadError(errorMessage(e)))
  }, [])

  // Chargement des articles (pour le sélecteur de casse) — tolère l'échec.
  useEffect(() => {
    listArticles()
      .then(setArticles)
      .catch(() => setArticles([]))
  }, [])

  // Recharge le mois affiché.
  const refreshMonth = () => {
    if (etabId == null) return
    const from = isoFor(year, month, 1)
    const lastDay = new Date(year, month + 1, 0).getDate()
    const to = isoFor(year, month, lastDay)
    listMonth(etabId, from, to)
      .then((list) => {
        const map: Record<string, DailyEntry> = {}
        for (const e of list) map[e.date] = e
        setEntries(map)
      })
      .catch((e) => setLoadError(errorMessage(e)))
  }
  useEffect(refreshMonth, [etabId, year, month])

  // Météo du mois (optionnelle, secondaire).
  const [weather, setWeather] = useState<MonthWeather>({})
  useEffect(() => {
    const lat = selectedEtab?.latitude
    const lon = selectedEtab?.longitude
    if (lat == null || lon == null) {
      setWeather({})
      return
    }
    let cancelled = false
    getMonthWeather(lat, lon, year, month)
      .then((w) => {
        if (!cancelled) setWeather(w)
      })
      .catch(() => {
        if (!cancelled) setWeather({})
      })
    return () => {
      cancelled = true
    }
  }, [etabId, year, month, selectedEtab?.latitude, selectedEtab?.longitude])

  // Calques activables (sélection multiple par boutons).
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [layers, setLayers] = useState<string[]>(['feries', 'religieux', 'fetes'])
  const [layersAnchor, setLayersAnchor] = useState<HTMLElement | null>(null)
  // Agenda mobile : conteneur scrollable auto-positionné sur J-2 (deux jours avant aujourd'hui).
  const agendaRef = useRef<HTMLDivElement | null>(null)
  const agendaTargetRef = useRef<HTMLDivElement | null>(null)
  // Base de calcul des % de l'IA — réglage global (engrenage du header).
  const { baseline } = useSettings()
  const [muslimDays, setMuslimDays] = useState<Record<string, string>>({})
  const [jewishDays, setJewishDays] = useState<Record<string, string>>({})

  // Fêtes & événements (liste curée, locale, synchrone) — calculée par année.
  const fetes = useMemo(() => getCuratedEvents(year), [year])

  // Jours fériés (année affichée + précédente, pour les comparaisons AR-1/AA-1).
  const [holidays, setHolidays] = useState<Holidays>({})
  useEffect(() => {
    let cancelled = false
    Promise.all([getHolidays(year), getHolidays(year - 1)])
      .then(([cur, prev]) => {
        if (!cancelled) setHolidays({ ...prev, ...cur })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [year])

  // Calendriers religieux du mois affiché (selon calques actifs) — tolère l'échec.
  useEffect(() => {
    let cancelled = false
    if (layers.includes('religieux')) {
      getMuslimDays(year, month)
        .then((d) => {
          if (!cancelled) setMuslimDays(d)
        })
        .catch(() => {
          if (!cancelled) setMuslimDays({})
        })
      getJewishDays(year, month)
        .then((d) => {
          if (!cancelled) setJewishDays(d)
        })
        .catch(() => {
          if (!cancelled) setJewishDays({})
        })
    } else {
      setMuslimDays({})
      setJewishDays({})
    }
    return () => {
      cancelled = true
    }
  }, [year, month, layers])

  // Données de l'an dernier (saisies + météo) pour les comparaisons AR-1 / AA-1.
  const [prevEntries, setPrevEntries] = useState<Record<string, DailyEntry>>({})
  const [prevWeather, setPrevWeather] = useState<MonthWeather>({})
  useEffect(() => {
    if (etabId == null) return
    // Fenêtre couvrant AR-1 (J-364) et AA-1 (J-1an) de tous les jours du mois.
    const lastDay = new Date(year, month + 1, 0).getDate()
    const from = toISODate(addDays(new Date(year, month, 1), -370))
    const to = toISODate(addDays(new Date(year, month, lastDay), -360))

    let cancelled = false
    listMonth(etabId, from, to)
      .then((list) => {
        if (cancelled) return
        const map: Record<string, DailyEntry> = {}
        for (const e of list) map[e.date] = e
        setPrevEntries(map)
      })
      .catch(() => {
        if (!cancelled) setPrevEntries({})
      })

    const lat = selectedEtab?.latitude
    const lon = selectedEtab?.longitude
    if (lat != null && lon != null) {
      getWeatherRange(lat, lon, from, to)
        .then((w) => {
          if (!cancelled) setPrevWeather(w)
        })
        .catch(() => {
          if (!cancelled) setPrevWeather({})
        })
    } else {
      setPrevWeather({})
    }
    return () => {
      cancelled = true
    }
  }, [etabId, year, month, selectedEtab?.latitude, selectedEtab?.longitude])

  // Popover de comparaison (AR-1 / AA-1).
  const [cmpAnchor, setCmpAnchor] = useState<HTMLElement | null>(null)
  const [cmpIso, setCmpIso] = useState<string | null>(null)
  const openCompare = (e: MouseEvent<HTMLElement>, iso: string) => {
    e.stopPropagation()
    setCmpAnchor(e.currentTarget)
    setCmpIso(iso)
  }
  const closeCompare = () => {
    setCmpAnchor(null)
    setCmpIso(null)
  }

  // Popup météo horaire au clic sur la météo d'une case (chargé à la demande, mis en cache).
  const [hourlyAnchor, setHourlyAnchor] = useState<{ el: HTMLElement; iso: string } | null>(null)
  const [hourlyCache, setHourlyCache] = useState<Record<string, HourWeather[]>>({})
  const [hourlyLoading, setHourlyLoading] = useState(false)
  const openHourly = async (e: MouseEvent<HTMLElement>, iso: string) => {
    e.stopPropagation()
    setHourlyAnchor({ el: e.currentTarget, iso })
    if (hourlyCache[iso]) return
    const lat = selectedEtab?.latitude
    const lon = selectedEtab?.longitude
    if (lat == null || lon == null) return
    setHourlyLoading(true)
    try {
      const hrs = await getHourlyWeather(lat, lon, iso)
      setHourlyCache((m) => ({ ...m, [iso]: hrs }))
    } catch {
      /* météo horaire indisponible : on n'affiche rien */
    } finally {
      setHourlyLoading(false)
    }
  }

  // Charge le jour sélectionné dans l'éditeur.
  const loadDay = (iso: string) => {
    if (etabId == null) return
    setEditorError(null)
    setEditorOk(null)
    getDay(etabId, iso)
      .then((d) => {
        setDay(d)
        setRevenueInput(d.revenue == null ? '' : String(d.revenue))
        setClientCountInput(d.clientCount == null ? '' : String(d.clientCount))
        setLossRows(
          (d.losses ?? []).map((l) => ({
            articleId: l.articleId,
            quantity: String(l.quantity),
          })),
        )
        setLossAmountInput(d.lossAmount == null ? '' : String(d.lossAmount))
        setNoteProdInput(d.noteProd ?? '')
        setNoteSaleInput(d.noteSale ?? '')
      })
      .catch((e) => setEditorError(errorMessage(e)))
  }

  const onSelectDay = (iso: string) => {
    setSelected(iso)
    loadDay(iso)
  }

  // Saut rapide vers une date (date picker au clic sur le mois).
  const jumpToDate = (iso: string) => {
    if (!iso) return
    const [y, m] = iso.split('-').map(Number)
    setYear(y)
    setMonth(m - 1)
    onSelectDay(iso)
  }

  const closeEditor = () => {
    setSelected(null)
    setDay(null)
    setEditorError(null)
    setEditorOk(null)
  }

  const prevMonth = () => {
    setSelected(null)
    setDay(null)
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }
  const nextMonth = () => {
    setSelected(null)
    setDay(null)
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const afterSave = (msg: string) => {
    setEditorOk(msg)
    refreshMonth()
    if (selected) loadDay(selected)
  }

  // Gestion des lignes de casse.
  const addLossRow = () =>
    setLossRows((rows) => [...rows, { articleId: null, quantity: '' }])
  const removeLossRow = (index: number) =>
    setLossRows((rows) => rows.filter((_, i) => i !== index))
  const updateLossRow = (index: number, patch: Partial<LossRow>) =>
    setLossRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const saveDayEntry = async () => {
    if (etabId == null || !selected) return
    setSaving(true)
    setEditorError(null)
    setEditorOk(null)
    try {
      const losses = lossRows
        .filter((r) => r.articleId != null && Number(r.quantity) > 0)
        .map((r) => ({ articleId: r.articleId as number, quantity: Number(r.quantity) }))
      await saveDay(etabId, selected, {
        revenue: Number(revenueInput) || 0,
        clientCount: Number(clientCountInput) || null,
        losses,
        lossAmount: lossAmountInput ? Number(lossAmountInput) : null,
        noteProd: noteProdInput,
        noteSale: noteSaleInput,
      })
      afterSave('Journée enregistrée.')
    } catch (e) {
      setEditorError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // Construction de la grille du mois.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7 // Lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  // Agenda mobile : on positionne le scroll sur J-1 (présent dans le mois affiché).
  const agendaTargetIso = toISODate(addDays(new Date(), -1))
  useEffect(() => {
    if (!isMobile) return
    const c = agendaRef.current
    const t = agendaTargetRef.current
    if (c && t) c.scrollTop = t.offsetTop
  }, [isMobile, year, month, weather, entries])

  // Bloc de comparaison (un jour de l'an dernier) pour le popover.
  const renderCompare = (label: string, iso: string | null) => {
    const e = iso ? prevEntries[iso] : undefined
    const w = iso ? prevWeather[iso] : undefined
    const wi = w ? weatherIcon(w.code) : null
    const hol = iso ? holidays[iso] : undefined
    return (
      <Box sx={{ py: 1 }}>
        <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
          {iso ? formatLongDate(iso) : '—'}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
          <Typography variant="body2">
            {wi ? `${wi.emoji} ${w?.tMax != null ? Math.round(w.tMax) + '°' : ''}` : 'Météo —'}
          </Typography>
          <Typography variant="body2">CA : {formatEur(e?.revenue)}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Clients : {e?.clientCount ?? '—'}
          {e?.revenue != null && e?.clientCount != null && e.clientCount > 0
            ? ` — ticket moyen ${formatEur(e.revenue / e.clientCount)}`
            : ''}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Perte :{' '}
          {e?.losses && e.losses.length > 0
            ? e.losses.map((l) => `${l.articleName} ×${l.quantity}`).join(', ')
            : '—'}
        </Typography>
        {e?.noteProd && (
          <Typography variant="caption" sx={{ display: 'block' }}>
            🥖 {e.noteProd}
          </Typography>
        )}
        {e?.noteSale && (
          <Typography variant="caption" sx={{ display: 'block' }}>
            🛒 {e.noteSale}
          </Typography>
        )}
        {hol && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
            🎉 {hol}
          </Typography>
        )}
      </Box>
    )
  }

  const cmpAr = cmpIso ? toISODate(addDays(dateFromIso(cmpIso), -364)) : null
  const cmpAa = cmpIso
    ? toISODate(new Date(dateFromIso(cmpIso).getFullYear() - 1, dateFromIso(cmpIso).getMonth(), dateFromIso(cmpIso).getDate()))
    : null

  // Analyse IA du mois (Gemini) — un conseil par jour notable.
  const [iaLoading, setIaLoading] = useState(false)
  const [iaAdvice, setIaAdvice] = useState<Record<string, string>>({})
  const [iaError, setIaError] = useState<string | null>(null)
  const [iaEnabled, setIaEnabled] = useState(true)

  // Vide les conseils IA quand on change de mois ou d'établissement.
  useEffect(() => {
    setIaAdvice({})
    setIaError(null)
    setIaEnabled(true)
  }, [etabId, year, month])

  // Construit le contexte de TOUS les jours du mois affiché.
  const buildMonthDays = (): DayContextInput[] => {
    const days: DayContextInput[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = isoFor(year, month, d)
      const dateObj = new Date(year, month, d)
      const events =
        [holidays[iso], muslimDays[iso] || jewishDays[iso], fetes[iso]]
          .filter(Boolean)
          .join(' · ') || null
      const caN1Date =
        prevEntries[toISODate(new Date(year - 1, month, d))]?.revenue ?? null
      const arIso = toISODate(addDays(dateObj, -364))
      const caN1Equiv = prevEntries[arIso]?.revenue ?? null
      const wx = weather[iso]
      const wxAr = prevWeather[arIso]
      days.push({
        date: iso,
        weekday: dateObj.toLocaleDateString('fr-FR', { weekday: 'long' }),
        revenue: entries[iso]?.revenue ?? null,
        clientCount: entries[iso]?.clientCount ?? null,
        tMax: wx?.tMax ?? null,
        tMaxN1: wxAr?.tMax ?? null,
        sky: wx ? weatherIcon(wx.code).label : null,
        skyN1: wxAr ? weatherIcon(wxAr.code).label : null,
        events,
        caN1Date,
        caN1Equiv,
        noteProd: entries[iso]?.noteProd ?? null,
        noteSale: entries[iso]?.noteSale ?? null,
        noteProdN1: prevEntries[arIso]?.noteProd ?? null,
        noteSaleN1: prevEntries[arIso]?.noteSale ?? null,
      })
    }
    return days
  }

  const analyzeMonth = async () => {
    setIaLoading(true)
    setIaError(null)
    try {
      const res = await getTrend({
        etablissement: selectedEtab?.name ?? 'établissement',
        description: selectedEtab?.description ?? null,
        location: selectedEtab?.address ?? null,
        periode: `${MONTHS[month]} ${year}`,
        baseline,
        days: buildMonthDays(),
      })
      setIaEnabled(res.enabled)
      const map: Record<string, string> = {}
      for (const d of res.days) {
        if (d.conseil) map[d.date] = d.conseil
      }
      setIaAdvice(map)
    } catch (e) {
      setIaError(errorMessage(e))
    } finally {
      setIaLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Calendrier & saisie"
        action={
          <TextField
            select
            label="Établissement"
            value={etabId ?? ''}
            onChange={(e) => {
              setEtabId(Number(e.target.value))
              setSelected(null)
              setDay(null)
            }}
            sx={{ minWidth: { xs: '100%', sm: 240 }, width: { xs: '100%', sm: 'auto' } }}
          >
            {etabs.length === 0 && <MenuItem value="">Aucun établissement</MenuItem>}
            {etabs.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name}
              </MenuItem>
            ))}
          </TextField>
        }
      />

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}

      {etabId != null && can('saisir_ca') && (
        <Stack direction="row" sx={{ mb: 2, alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={ticketScanning ? <CircularProgress size={16} /> : <DocumentScannerIcon />}
            onClick={() => ticketGlobalRef.current?.click()}
            disabled={ticketScanning}
          >
            {ticketScanning ? 'Lecture du ticket…' : 'Scanner un ticket Z'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            L'IA lit la date et ouvre le bon jour.
          </Typography>
          <input
            ref={ticketGlobalRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              void onScanTicketGlobal(f)
            }}
          />
        </Stack>
      )}
      {scanMsg && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setScanMsg(null)}>
          {scanMsg}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
          >
            <IconButton onClick={prevMonth} aria-label="Mois précédent">
              <ChevronLeftIcon />
            </IconButton>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
              <Tooltip title="Choisir une date">
                <Typography
                  variant="h2"
                  sx={{ m: 0, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  onClick={() => {
                    const el = monthPickerRef.current
                    if (!el) return
                    try {
                      el.showPicker()
                    } catch {
                      el.click()
                    }
                  }}
                >
                  {MONTHS[month]} {year}
                </Typography>
              </Tooltip>
              <input
                ref={monthPickerRef}
                type="date"
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                value={selected ?? `${year}-${String(month + 1).padStart(2, '0')}-01`}
                onChange={(e) => jumpToDate(e.target.value)}
                tabIndex={-1}
                aria-hidden
              />
              <Tooltip title="Analyser le mois avec l'IA">
                <span>
                  <IconButton
                    color="primary"
                    onClick={analyzeMonth}
                    disabled={!selectedEtab || iaLoading}
                    aria-label="Analyser le mois avec l'IA"
                  >
                    {iaLoading ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <IconButton onClick={nextMonth} aria-label="Mois suivant">
              <ChevronRightIcon />
            </IconButton>
          </Stack>

          {!iaEnabled && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Analyse IA non configurée sur ce serveur.
            </Alert>
          )}
          {iaError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {iaError}
            </Alert>
          )}

          {isMobile ? (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<LayersIcon />}
                onClick={(e) => setLayersAnchor(e.currentTarget)}
                sx={{ mb: 1 }}
              >
                Calques ({layers.length})
              </Button>
              <Popover
                open={Boolean(layersAnchor)}
                anchorEl={layersAnchor}
                onClose={() => setLayersAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              >
                <ToggleButtonGroup
                  size="small"
                  orientation="vertical"
                  value={layers}
                  onChange={(_, next) => setLayers(next)}
                  aria-label="Calques du calendrier"
                  sx={{ m: 1 }}
                >
                  <ToggleButton value="feries">Fériés</ToggleButton>
                  <ToggleButton value="religieux">🕌 Événements religieux</ToggleButton>
                  <ToggleButton value="fetes">🎉 Fêtes &amp; événements</ToggleButton>
                </ToggleButtonGroup>
              </Popover>
            </>
          ) : (
            <ToggleButtonGroup
              size="small"
              value={layers}
              onChange={(_, next) => setLayers(next)}
              aria-label="Calques du calendrier"
              sx={{ mb: 1, flexWrap: 'wrap' }}
            >
              <ToggleButton value="feries">Fériés</ToggleButton>
              <ToggleButton value="religieux">🕌 Événements religieux</ToggleButton>
              <ToggleButton value="fetes">🎉 Fêtes &amp; événements</ToggleButton>
            </ToggleButtonGroup>
          )}


          <Stack
            direction="row"
            sx={{ gap: 2, flexWrap: 'wrap', mb: 1.5, color: 'text.disabled' }}
          >
            <Typography variant="caption">
              <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid', borderColor: 'divider', mr: 0.5, verticalAlign: 'middle' }} />
              Week-end
            </Typography>
            <Typography variant="caption">
              <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, bgcolor: 'rgba(181,101,29,0.12)', border: '1px solid', borderColor: 'primary.main', mr: 0.5, verticalAlign: 'middle' }} />
              Jour férié
            </Typography>
            <Typography variant="caption">
              <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, bgcolor: 'rgba(123, 31, 162, 0.13)', border: '1px solid', borderColor: '#7b1fa2', mr: 0.5, verticalAlign: 'middle' }} />
              Fête religieuse
            </Typography>
            <Typography variant="caption">
              <Box component="span" sx={{ display: 'inline-block', width: 10, height: 10, bgcolor: 'rgba(21, 101, 192, 0.12)', border: '1px solid', borderColor: '#1565c0', mr: 0.5, verticalAlign: 'middle' }} />
              Fête / événement
            </Typography>
            <Typography variant="caption">ℹ️ comparaison AR-1 / AA-1</Typography>
          </Stack>

          {selectedEtab &&
            (selectedEtab.latitude == null || selectedEtab.longitude == null) && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Géolocalisez l'établissement pour voir la météo.
              </Typography>
            )}

          {/* --- Vue AGENDA (mobile uniquement) : liste verticale jour par jour --- */}
          <Box
            ref={agendaRef}
            sx={{
              display: { xs: 'flex', sm: 'none' },
              flexDirection: 'column',
              gap: 0.5,
              position: 'relative',
              maxHeight: '65vh',
              overflowY: 'auto',
            }}
          >
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const iso = isoFor(year, month, d)
              const entry = entries[iso]
              const isToday = iso === todayIso
              const isSelected = iso === selected
              const wx = weather[iso]
              const wxInfo = wx ? weatherIcon(wx.code) : null
              const dow = new Date(year, month, d).getDay()
              const isWeekend = dow === 0 || dow === 6
              const wdLabel = WEEKDAYS[(dow + 6) % 7]
              const holiday = holidays[iso]
              const religiousName = layers.includes('religieux')
                ? muslimDays[iso] || jewishDays[iso] || null
                : null
              const feteName = layers.includes('fetes') ? fetes[iso] || null : null
              const labels: Array<{ text: string; color: string }> = []
              if (holiday) labels.push({ text: holiday, color: 'primary.main' })
              if (religiousName) labels.push({ text: religiousName, color: '#7b1fa2' })
              if (feteName) labels.push({ text: feteName, color: '#1565c0' })

              return (
                <Box
                  key={iso}
                  ref={iso === agendaTargetIso ? agendaTargetRef : undefined}
                  onClick={() => onSelectDay(iso)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: isSelected || isToday ? 'primary.main' : 'divider',
                    borderWidth: isSelected ? 2 : 1,
                    bgcolor: isSelected
                      ? 'action.selected'
                      : isWeekend
                        ? 'rgba(0,0,0,0.03)'
                        : 'background.paper',
                  }}
                >
                  {/* Date : jour de semaine + n° */}
                  <Box sx={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', lineHeight: 1, textTransform: 'lowercase' }}
                    >
                      {wdLabel}
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: isToday ? 'bold' : 600, lineHeight: 1.1 }}
                      color={isToday ? 'primary' : 'text.primary'}
                    >
                      {d}
                    </Typography>
                  </Box>

                  {/* Météo + fêtes */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {wxInfo && (
                      <Stack
                        direction="row"
                        onClick={(e) => openHourly(e, iso)}
                        sx={{ alignItems: 'center', gap: 0.5, cursor: 'pointer', width: 'fit-content' }}
                      >
                        <Box component="span" sx={{ fontSize: '1rem', lineHeight: 1 }}>
                          {wxInfo.emoji}
                        </Box>
                        {wx?.tMax != null && (
                          <Typography variant="caption" color="text.secondary">
                            {Math.round(wx.tMax)}°
                          </Typography>
                        )}
                      </Stack>
                    )}
                    {labels.map((l) => (
                      <Typography
                        key={l.text}
                        variant="caption"
                        sx={{ display: 'block', lineHeight: 1.25, color: l.color }}
                      >
                        {l.text}
                      </Typography>
                    ))}
                  </Box>

                  {/* CA + progression + comparaison */}
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    {entry && entry.revenue != null ? (
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {formatEur(entry.revenue)}
                      </Typography>
                    ) : entry ? (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                    ) : null}
                    <DayTrend delta={dayTrendPct(entries, prevEntries, new Date(year, month, d))} />
                    {iaAdvice[iso] && (
                      <Box
                        component="span"
                        onClick={(e) => openCompare(e, iso)}
                        sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <AutoAwesomeIcon color="primary" sx={{ fontSize: '1rem' }} />
                      </Box>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => openCompare(e, iso)}
                      aria-label="Comparaison année précédente"
                      sx={{ p: 0.25, color: 'text.disabled' }}
                    >
                      <InfoOutlinedIcon sx={{ fontSize: '1.1rem' }} />
                    </IconButton>
                  </Stack>
                </Box>
              )
            })}
          </Box>

          {/* --- Vue GRILLE (tablette/desktop) : calendrier mensuel 7 colonnes --- */}
          <Box sx={{ display: { xs: 'none', sm: 'grid' }, gridTemplateColumns: 'repeat(7, 1fr)', gap: { xs: 0.5, sm: 1 } }}>
            {WEEKDAYS.map((w) => (
              <Typography
                key={w}
                variant="body2"
                color="text.secondary"
                align="center"
                sx={{ fontWeight: 'bold', py: 0.5, fontSize: { xs: '0.68rem', sm: '0.875rem' } }}
              >
                {w}
              </Typography>
            ))}
            {cells.map((d, i) => {
              if (d == null) return <Box key={`e${i}`} />
              const iso = isoFor(year, month, d)
              const entry = entries[iso]
              const isToday = iso === todayIso
              const isSelected = iso === selected
              const wx = weather[iso]
              const wxInfo = wx ? weatherIcon(wx.code) : null
              const dow = new Date(year, month, d).getDay()
              const isWeekend = dow === 0 || dow === 6
              const isSaturday = dow === 6
              const holiday = holidays[iso]

              // Fête religieuse : calque actif ET vraie fête (musulmane ou juive).
              const religiousName =
                layers.includes('religieux')
                  ? muslimDays[iso] || jewishDays[iso] || null
                  : null
              const isReligious = Boolean(religiousName)

              // Fête / événement : calque actif ET libellé curé pour ce jour.
              const feteName = layers.includes('fetes') ? fetes[iso] || null : null
              const isFete = Boolean(feteName)

              // Marqueurs de calques.
              const markers: string[] = []
              if (layers.includes('feries') && holiday) markers.push('🎉')
              // Samedis (Shabbat) non colorés : on garde un ✡️ discret.
              if (layers.includes('religieux') && isSaturday && !isReligious) markers.push('✡️')

              const bg = isSelected
                ? 'action.selected'
                : holiday
                  ? 'rgba(181,101,29,0.12)'
                  : isReligious
                    ? 'rgba(123, 31, 162, 0.13)'
                    : isFete
                      ? 'rgba(21, 101, 192, 0.12)'
                      : isWeekend
                        ? 'rgba(0,0,0,0.05)'
                        : 'background.paper'

              return (
                <Box
                  key={iso}
                  onClick={() => onSelectDay(iso)}
                  sx={{
                    position: 'relative',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: isSelected || isToday ? 'primary.main' : 'divider',
                    borderWidth: isSelected ? 2 : 1,
                    borderTop: holiday || isReligious || isFete ? '3px solid' : undefined,
                    borderTopColor: holiday
                      ? 'primary.main'
                      : isReligious
                        ? '#7b1fa2'
                        : isFete
                          ? '#1565c0'
                          : undefined,
                    borderRadius: 1.5,
                    bgcolor: bg,
                    minHeight: { xs: 62, sm: 100 },
                    p: { xs: 0.5, sm: 1 },
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'background-color .15s, border-color .15s',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  {/* En-tête de case : n° du jour + météo */}
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: isToday ? 'bold' : 600 }}
                      color={isToday ? 'primary' : 'text.primary'}
                    >
                      {d}
                    </Typography>
                    {wxInfo && (
                      <Tooltip title={`${wxInfo.label} — voir le détail horaire`}>
                        <Stack
                          direction="row"
                          onClick={(e) => openHourly(e, iso)}
                          sx={{ alignItems: 'center', gap: 0.25, lineHeight: 1, cursor: 'pointer' }}
                        >
                          <Box component="span" sx={{ fontSize: { xs: '0.85rem', sm: '1.1rem' } }}>
                            {wxInfo.emoji}
                          </Box>
                          {wx?.tMax != null && (
                            <Typography variant="caption" color="text.primary" sx={{ fontSize: '0.72rem', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
                              {Math.round(wx.tMax)}°
                            </Typography>
                          )}
                        </Stack>
                      </Tooltip>
                    )}
                  </Stack>

                  {/* Nom du jour férié (tronqué) */}
                  {holiday && (
                    <Typography
                      variant="caption"
                      color="primary"
                      sx={{ fontSize: '0.6rem', lineHeight: 1.1, mt: 0.25, display: { xs: 'none', sm: '-webkit-box' }, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                      {holiday}
                    </Typography>
                  )}

                  {/* Nom de la fête religieuse (tronqué) */}
                  {religiousName && (
                    <Typography
                      variant="caption"
                      sx={{ fontSize: '0.6rem', lineHeight: 1.1, mt: 0.25, color: '#7b1fa2', display: { xs: 'none', sm: '-webkit-box' }, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                      {religiousName}
                    </Typography>
                  )}

                  {/* Nom de la fête / événement (tronqué) */}
                  {feteName && (
                    <Typography
                      variant="caption"
                      sx={{ fontSize: '0.6rem', lineHeight: 1.1, mt: 0.25, color: '#1565c0', display: { xs: 'none', sm: '-webkit-box' }, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                      {feteName}
                    </Typography>
                  )}

                  {/* Marqueurs de calques (observances) */}
                  {markers.length > 0 && (
                    <Box sx={{ fontSize: '0.7rem', lineHeight: 1.2, mt: 0.25 }}>
                      {markers.join(' ')}
                    </Box>
                  )}

                  {/* Pied de case : CA + progression + bouton comparaison */}
                  <Stack direction="row" sx={{ mt: 'auto', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                      {entry && entry.revenue != null ? (
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                          {formatEur(entry.revenue)}
                        </Typography>
                      ) : entry ? (
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                      ) : null}
                      <DayTrend delta={dayTrendPct(entries, prevEntries, new Date(year, month, d))} />
                    </Stack>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.25 }}>
                      {iaAdvice[iso] && (
                        <Tooltip title="Conseil IA — voir le détail">
                          <Box
                            component="span"
                            onClick={(e) => openCompare(e, iso)}
                            sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                          >
                            <AutoAwesomeIcon color="primary" sx={{ fontSize: '0.9rem' }} />
                          </Box>
                        </Tooltip>
                      )}
                      <Tooltip title="Comparaison N-1 (jour équivalent & date à date)">
                        <IconButton
                          size="small"
                          onClick={(e) => openCompare(e, iso)}
                          aria-label="Comparaison année précédente"
                          sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                        >
                          <InfoOutlinedIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Box>
              )
            })}
          </Box>
        </CardContent>
      </Card>

      {/* Popover météo heure par heure (clic sur la météo d'une case) */}
      <Popover
        open={Boolean(hourlyAnchor)}
        anchorEl={hourlyAnchor?.el}
        onClose={() => setHourlyAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box sx={{ p: 1.5, maxWidth: 360 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ textTransform: 'capitalize' }}>
            Météo heure par heure{hourlyAnchor ? ` — ${formatLongDate(hourlyAnchor.iso)}` : ''}
          </Typography>
          {hourlyLoading && !(hourlyAnchor && hourlyCache[hourlyAnchor.iso]) ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">Chargement…</Typography>
            </Stack>
          ) : hourlyAnchor && (hourlyCache[hourlyAnchor.iso]?.length ?? 0) > 0 ? (
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
              {hourlyCache[hourlyAnchor.iso]
                .filter((h) => h.hour >= 5 && h.hour <= 23)
                .map((h) => (
                  <Stack key={h.hour} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ minWidth: 30 }}>
                      {String(h.hour).padStart(2, '0')}h
                    </Typography>
                    <Box component="span">{weatherIcon(h.code).emoji}</Box>
                    <Typography variant="caption">{h.temp != null ? `${Math.round(h.temp)}°` : '—'}</Typography>
                    {h.precipProb != null && h.precipProb >= 30 && (
                      <Typography variant="caption" color="primary">{h.precipProb}%</Typography>
                    )}
                  </Stack>
                ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">Détail horaire indisponible.</Typography>
          )}
        </Box>
      </Popover>

      {/* Popover de comparaison année précédente */}
      <Popover
        open={Boolean(cmpAnchor)}
        anchorEl={cmpAnchor}
        onClose={closeCompare}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box sx={{ p: 2, maxWidth: 340 }}>
          <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
            Comparaison — {cmpIso ? formatLongDate(cmpIso) : ''}
          </Typography>
          <Divider sx={{ my: 1 }} />

          {/* Conseil de l'IA pour ce jour, le cas échéant */}
          {cmpIso && iaAdvice[cmpIso] && (
            <Box sx={{ pb: 1 }}>
              <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
                🔮 Conseil IA
              </Typography>
              <Typography variant="body2">{iaAdvice[cmpIso]}</Typography>
              <Divider sx={{ my: 1 }} />
            </Box>
          )}

          {/* Observances actives ce jour-là */}
          {cmpIso && (() => {
            const cmpDow = dateFromIso(cmpIso).getDay()
            const isSat = cmpDow === 6
            const items: string[] = []
            const wx = weather[cmpIso]
            if (wx) {
              const wi = weatherIcon(wx.code)
              items.push(`${wi.emoji} ${wi.label}${wx.tMax != null ? ` ${Math.round(wx.tMax)}°` : ''}`)
            }
            if (layers.includes('feries') && holidays[cmpIso]) items.push(`🎉 ${holidays[cmpIso]}`)
            if (layers.includes('religieux')) {
              if (muslimDays[cmpIso]) items.push(`🌙 ${muslimDays[cmpIso]}`)
              if (jewishDays[cmpIso] || isSat) {
                const jl = [jewishDays[cmpIso], isSat ? 'Shabbat' : null].filter(Boolean).join(' · ')
                items.push(`✡️ ${jl}`)
              }
            }
            if (layers.includes('fetes') && fetes[cmpIso]) items.push(fetes[cmpIso])
            return (
              <Box sx={{ pb: 1 }}>
                <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
                  Ce jour-là
                </Typography>
                {items.length > 0 ? (
                  items.map((it, i) => (
                    <Typography key={i} variant="body2" sx={{ display: 'block' }}>
                      {it}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Rien à signaler.
                  </Typography>
                )}
              </Box>
            )
          })()}

          <Divider sx={{ my: 1 }} />
          {renderCompare('AR-1 · jour équivalent (J-364)', cmpAr)}
          <Divider />
          {renderCompare('AA-1 · date à date (N-1)', cmpAa)}
        </Box>
      </Popover>

      <Modal
        open={selected != null}
        onClose={closeEditor}
        title={selected ? `Saisie du ${formatLongDate(selected)}` : ''}
      >
        <Stack spacing={3}>
          {editorError && <Alert severity="error">{editorError}</Alert>}
          {editorOk && <Alert severity="success">{editorOk}</Alert>}

          {/* Repère N-1 directement dans la saisie */}
          {selected && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              {(() => {
                const ar = toISODate(addDays(dateFromIso(selected), -364))
                const aa = toISODate(
                  new Date(dateFromIso(selected).getFullYear() - 1, dateFromIso(selected).getMonth(), dateFromIso(selected).getDate()),
                )
                const arE = prevEntries[ar]
                const aaE = prevEntries[aa]
                return (
                  <>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`AR-1 : CA ${formatEur(arE?.revenue)}`}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`AA-1 : CA ${formatEur(aaE?.revenue)}`}
                    />
                  </>
                )
              })()}
            </Stack>
          )}

          {/* CA Global */}
          <Box>
            <TextField
              label="CA Global (TTC)"
              type="number"
              value={revenueInput}
              disabled={!can('saisir_ca')}
              onChange={(e) => setRevenueInput(e.target.value)}
              slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
              fullWidth
            />
            {!can('saisir_ca') && (
              <Typography variant="body2" color="text.secondary">
                Lecture seule
              </Typography>
            )}
            <TextField
              label="Nombre de clients"
              type="number"
              value={clientCountInput}
              disabled={!can('saisir_ca')}
              onChange={(e) => setClientCountInput(e.target.value)}
              slotProps={{ htmlInput: { step: '1', min: '0' } }}
              fullWidth
              sx={{ mt: 2 }}
            />
            {Number(revenueInput) > 0 && Number(clientCountInput) > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Ticket moyen :{' '}
                {(Number(revenueInput) / Number(clientCountInput)).toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 2,
                })}
              </Typography>
            )}
            {can('saisir_ca') && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    ticketScanning ? <CircularProgress size={14} /> : <DocumentScannerIcon />
                  }
                  onClick={() => ticketFileRef.current?.click()}
                  disabled={ticketScanning}
                  sx={{ mt: 1.5 }}
                >
                  {ticketScanning ? 'Lecture du ticket…' : 'Scanner le ticket Z'}
                </Button>
                <input
                  ref={ticketFileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    void onScanTicket(f)
                  }}
                />
              </>
            )}
          </Box>

          {/* Perte (en valeur) */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Perte (€)
            </Typography>
            <TextField
              label="Montant de perte (TTC)"
              type="number"
              value={lossAmountInput}
              disabled={!can('saisir_perte')}
              onChange={(e) => setLossAmountInput(e.target.value)}
              slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
              fullWidth
            />
          </Box>

          {/* Perte (par article) */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Perte (par article)
            </Typography>
            <Stack spacing={1}>
              {lossRows.map((row, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <TextField
                    select
                    label="Article"
                    value={row.articleId ?? ''}
                    disabled={!can('saisir_perte')}
                    onChange={(e) =>
                      updateLossRow(i, {
                        articleId: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {articles.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.code ? `${a.code} — ${a.name}` : a.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Quantité"
                    type="number"
                    value={row.quantity}
                    disabled={!can('saisir_perte')}
                    onChange={(e) => updateLossRow(i, { quantity: e.target.value })}
                    slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
                    sx={{ width: { xs: 88, sm: 120 }, flexShrink: 0 }}
                  />
                  <Tooltip title="Supprimer la ligne">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={!can('saisir_perte')}
                        onClick={() => removeLossRow(i)}
                        aria-label="Supprimer la ligne"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
            {can('saisir_perte') ? (
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addLossRow} sx={{ mt: 1 }}>
                Ajouter une ligne
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Lecture seule
              </Typography>
            )}
          </Box>

          {/* Mot du jour (Production) */}
          <Box>
            <TextField
              label="Mot du jour (Production)"
              multiline
              minRows={2}
              value={noteProdInput}
              disabled={!can('saisir_mot_du_jour')}
              onChange={(e) => setNoteProdInput(e.target.value)}
              fullWidth
            />
            {!can('saisir_mot_du_jour') && (
              <Typography variant="body2" color="text.secondary">
                Lecture seule
              </Typography>
            )}
          </Box>

          {/* Mot du jour (Vente) */}
          <Box>
            <TextField
              label="Mot du jour (Vente)"
              multiline
              minRows={2}
              value={noteSaleInput}
              disabled={!can('saisir_mot_du_jour')}
              onChange={(e) => setNoteSaleInput(e.target.value)}
              fullWidth
            />
            {!can('saisir_mot_du_jour') && (
              <Typography variant="body2" color="text.secondary">
                Lecture seule
              </Typography>
            )}
          </Box>

          <Box>
            <Button variant="contained" disabled={saving} onClick={saveDayEntry}>
              {saving ? 'Enregistrement…' : 'Enregistrer la journée'}
            </Button>
          </Box>

          {day?.updatedAt && (
            <Typography variant="body2" color="text.secondary">
              Dernière mise à jour : {new Date(day.updatedAt).toLocaleString('fr-FR')}
            </Typography>
          )}
        </Stack>
      </Modal>
    </>
  )
}
