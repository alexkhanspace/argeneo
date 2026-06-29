import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Alert, Box, Card, CardContent, Chip, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { LineChart } from '@mui/x-charts/LineChart'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import { errorMessage } from '../../api/client'
import { listMonth, listMyEtablissements } from '../../api/daily'
import { listArticles } from '../../api/costing'
import type { Article, DailyEntry, MyEtablissement } from '../../api/types'
import { aggregate, eur, eur2, eurAxis, intFr, priceMap, todayIso, WEEKDAYS } from '../../dashboard/analytics'
import {
  bucketRange,
  buildBucketSeries,
  buildSeries,
  defaultRefKey,
  fetchFrom,
  type BucketSeries,
  type CompareMode,
  type Gran,
} from '../../dashboard/period'
import { widgetDef, type WidgetCtx } from '../../dashboard/widgets'
import { PeriodNav } from '../../dashboard/PeriodNav'
import { PageHeader } from '../../components/PageHeader'

const TODAY = todayIso()

// Mêmes teintes que les widgets : sable pour N-1, brun terre pour N.
const COLOR_PREV = '#cdbba6'
const COLOR_CUR = '#c2410c'

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
/** Jour de la semaine 0=Lun..6=Dim depuis une date ISO (sans décalage de fuseau). */
const weekdayMon0 = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}
const eurTip = (v: number | null): string => (v == null ? '' : eur(v))

/** Badge d'évolution vs N-1 (vert si en hausse, rouge si en baisse). */
function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return null
  const flat = Math.abs(pct) < 0.05
  const up = pct >= 0
  const color = flat ? 'default' : up ? 'success' : 'error'
  const Icon = flat ? TrendingFlatIcon : up ? TrendingUpIcon : TrendingDownIcon
  return (
    <Chip
      size="small"
      color={color}
      variant="outlined"
      icon={<Icon fontSize="small" />}
      label={`${up && !flat ? '+' : ''}${pct.toFixed(1)} %`}
      sx={{ fontWeight: 600 }}
    />
  )
}

/** Carte indicateur de la synthèse : libellé, grande valeur, info secondaire / évolution. */
function StatCard({
  label,
  value,
  sub,
  accent,
  delta,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  delta?: number | null
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, height: '100%' }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </Typography>
        <Typography
          variant="h4"
          color={accent ? 'primary' : 'text.primary'}
          sx={{ fontWeight: 700, fontSize: { xs: '1.4rem', sm: '1.9rem' }, lineHeight: 1.15 }}
        >
          {value}
        </Typography>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 'auto', flexWrap: 'wrap' }}>
          {sub && (
            <Typography variant="caption" color="text.secondary">
              {sub}
            </Typography>
          )}
          {delta !== undefined && <Delta pct={delta} />}
        </Stack>
      </CardContent>
    </Card>
  )
}

/** En-tête de section (synthèse / détail / vue d'ensemble). */
function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <Box sx={{ mt: 4, mb: 2 }}>
      <Typography variant="h2">{title}</Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  )
}

/** Carte titrée générique. */
function Panel({ title, full, children }: { title: string; full?: boolean; children: ReactNode }) {
  return (
    <Box sx={{ gridColumn: full ? { xs: 'span 1', md: '1 / -1' } : 'span 1', minWidth: 0 }}>
      <Card sx={{ height: '100%', minWidth: 0 }}>
        <CardContent sx={{ overflowX: 'hidden' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
            {title}
          </Typography>
          {children}
        </CardContent>
      </Card>
    </Box>
  )
}

/** Panneau réutilisant le rendu d'un widget du registre (graphe ou table). */
function WidgetPanel({ type, ctx, full }: { type: string; ctx: WidgetCtx; full?: boolean }) {
  const def = widgetDef(type)
  if (!def) return null
  return (
    <Panel title={def.label} full={full}>
      {def.render(ctx)}
    </Panel>
  )
}

/** Détail de la période choisie, sous-unité par sous-unité (jours / mois), N vs N-1. */
function PeriodChart({ sub }: { sub: BucketSeries }) {
  if (sub.empty) return null
  const series = [
    { data: sub.caPrev, label: sub.prevLabel, color: COLOR_PREV, valueFormatter: eurTip },
    { data: sub.caCur, label: sub.curLabel, color: COLOR_CUR, valueFormatter: eurTip },
  ]
  return (
    <Panel title={sub.title} full>
      {sub.kind === 'line' ? (
        <LineChart
          height={300}
          xAxis={[{ scaleType: 'point', data: sub.labels }]}
          yAxis={[{ valueFormatter: (v: number) => eurAxis(v) }]}
          series={[{ ...series[0] }, { ...series[1], area: true }]}
        />
      ) : (
        <BarChart
          height={300}
          xAxis={[{ scaleType: 'band', data: sub.labels }]}
          yAxis={[{ valueFormatter: (v: number) => eurAxis(v) }]}
          series={series}
        />
      )}
    </Panel>
  )
}

const grid2 = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
  gap: 2,
  alignItems: 'start',
} as const

/** Vue analytique unifiée, centrée sur la période choisie et comparée à N-1. */
export function AnalyticsPage() {
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [etabId, setEtabId] = useState<number | null>(null)
  const [gran, setGran] = useState<Gran>('mois')
  const [refKey, setRefKey] = useState(() => defaultRefKey('mois', TODAY))
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Jours de semaine inclus dans l'analyse (0=Lun..6=Dim). Permet d'exclure p. ex. le
  // dimanche pour comparer N/N-1 à périmètre égal quand l'ouverture a changé d'une année sur l'autre.
  const [includedDays, setIncludedDays] = useState<number[]>(ALL_DAYS)
  // Comparaison N-1 : jour équivalent (même jour de semaine) par défaut — plus pertinent
  // pour un commerce où l'activité dépend du jour de la semaine — ou date à date.
  const [compareMode, setCompareMode] = useState<CompareMode>('equiv')

  useEffect(() => {
    listMyEtablissements()
      .then((list) => {
        setEtabs(list)
        if (list.length > 0) {
          setLoading(true)
          setEtabId(list[0].id)
        }
      })
      .catch((e) => setError(errorMessage(e)))
    listArticles().then(setArticles).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (etabId == null) return
    let cancelled = false
    void (async () => {
      try {
        // On récupère jusqu'à aujourd'hui ET l'an N-1 (fetchFrom) pour les comparaisons.
        const d = await listMonth(etabId, fetchFrom(gran, refKey), TODAY)
        if (!cancelled) {
          setEntries(d)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(errorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [etabId, gran, refKey])

  // Saisie filtrée des jours de semaine exclus (mêmes jours retirés des deux années
  // → comparaison N/N-1 honnête). Tous les calculs en aval partent de cette base.
  const fEntries = useMemo(() => {
    if (includedDays.length === ALL_DAYS.length) return entries
    const keep = new Set(includedDays)
    return entries.filter((e) => keep.has(weekdayMon0(e.date)))
  }, [entries, includedDays])

  // Agrégat de LA période choisie (pas de la fenêtre glissante) → les KPI collent au sélecteur.
  const bucketAgg = useMemo(() => {
    const price = priceMap(articles)
    const { from, to } = bucketRange(gran, refKey, TODAY)
    return aggregate(
      fEntries.filter((e) => e.date >= from && e.date <= to),
      price,
    )
  }, [fEntries, articles, gran, refKey])

  // Séries N vs N-1 : fenêtre glissante (vue d'ensemble) + détail interne de la période.
  const cmp = useMemo(
    () => buildSeries(fEntries, gran, refKey, TODAY, compareMode, includedDays),
    [fEntries, gran, refKey, compareMode, includedDays],
  )
  const sub = useMemo(
    () => buildBucketSeries(fEntries, gran, refKey, compareMode, includedDays),
    [fEntries, gran, refKey, compareMode, includedDays],
  )

  // Les widgets « détail » lisent agg (= période choisie) ; les widgets « tendance » lisent comparison.
  const ctx: WidgetCtx = useMemo(() => ({ agg: bucketAgg, comparison: cmp }), [bucketAgg, cmp])

  const onGran = (g: Gran) => {
    setLoading(true)
    setGran(g)
    setRefKey(defaultRefKey(g, TODAY))
  }

  type Stat = { label: string; value: string; sub?: string; accent?: boolean; delta?: number | null }
  const synthese: Stat[] = [
    {
      label: 'CA total',
      value: eur(bucketAgg.totalCA),
      accent: true,
      delta: cmp.deltaPct,
      sub: cmp.deltaPct != null ? 'vs même période N-1' : undefined,
    },
    { label: 'CA moyen / jour', value: eur(bucketAgg.avgCA), sub: `${intFr(bucketAgg.nbDays)} jours saisis` },
    { label: 'Clients', value: intFr(bucketAgg.totalClients) },
    { label: 'Ticket moyen', value: eur2(bucketAgg.avgTicket) },
    { label: 'Pertes (TTC)', value: eur(bucketAgg.lossValue), sub: `${intFr(bucketAgg.lossUnits)} unités` },
  ]

  const jourVeille: Stat[] = [
    {
      label: "CA d'aujourd'hui",
      value: cmp.todayCA == null ? '— (non saisi)' : eur2(cmp.todayCA),
      sub: cmp.todayClients != null ? `${intFr(cmp.todayClients)} clients` : undefined,
    },
    {
      label: 'CA de la veille',
      value: cmp.yesterdayCA == null ? '—' : eur2(cmp.yesterdayCA),
      sub: cmp.yesterdayClients != null ? `${intFr(cmp.yesterdayClients)} clients` : undefined,
    },
  ]

  const card = (s: Stat): ReactNode => (
    <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} accent={s.accent} delta={s.delta} />
  )

  return (
    <>
      <PageHeader
        title="Analytique"
        subtitle="Tout est calculé sur la période choisie ci-dessous et comparé à l'an dernier (N-1)."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <PeriodNav
        etabs={etabs}
        etabId={etabId}
        onEtab={(id) => {
          setLoading(true)
          setEtabId(id)
        }}
        gran={gran}
        onGran={onGran}
        refKey={refKey}
        onRef={(k) => {
          setLoading(true)
          setRefKey(k)
        }}
        today={TODAY}
        loading={loading}
      />

      {/* Mode de comparaison à N-1 : jour équivalent (même jour de semaine) ou date à date. */}
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          Comparaison N-1 :
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={compareMode}
          onChange={(_, v: CompareMode | null) => v && setCompareMode(v)}
          aria-label="Mode de comparaison à l'an dernier"
        >
          <ToggleButton value="equiv">Jour équivalent</ToggleButton>
          <ToggleButton value="date">Date à date</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary">
          {compareMode === 'equiv'
            ? 'même jour de semaine l’an dernier (−364 j)'
            : 'même date calendaire l’an dernier'}
        </Typography>
      </Stack>

      {/* Jours analysés : permet d'exclure p. ex. le dimanche des deux années à la fois. */}
      <Stack
        direction="row"
        sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          Jours analysés :
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={includedDays}
          onChange={(_, v: number[]) => {
            if (v.length > 0) setIncludedDays([...v].sort((a, b) => a - b))
          }}
          aria-label="Jours de la semaine inclus dans l'analyse"
        >
          {WEEKDAYS.map((d, i) => (
            <ToggleButton key={d} value={i} sx={{ px: 1.25 }}>
              {d}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {includedDays.length < ALL_DAYS.length && (
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label={`${ALL_DAYS.filter((d) => !includedDays.includes(d)).map((d) => WEEKDAYS[d]).join(', ')} exclu(s) — comparaison à périmètre égal`}
          />
        )}
      </Stack>

      {/* — Synthèse de la période choisie — */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        {synthese.map(card)}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2, mt: 2 }}>
        {jourVeille.map(card)}
      </Box>

      {/* — Détail de la période choisie — */}
      <SectionTitle title="Détail de la période" hint="Évolution interne et analyse des pertes sur la période choisie, vs N-1." />
      <Box sx={grid2}>
        <PeriodChart sub={sub} />
        <WidgetPanel type="loss_pie" ctx={ctx} />
        <WidgetPanel type="table_loss" ctx={ctx} />
        <WidgetPanel type="table_best" ctx={ctx} full />
      </Box>

      {/* — Vue d'ensemble (fenêtre glissante) — */}
      <SectionTitle title="Vue d'ensemble" hint="Tendances sur la fenêtre récente, comparées à l'an dernier." />
      <Box sx={grid2}>
        <WidgetPanel type="ca_line" ctx={ctx} full />
        <WidgetPanel type="ca_weekday" ctx={ctx} />
        <WidgetPanel type="ticket_month" ctx={ctx} />
      </Box>
    </>
  )
}
