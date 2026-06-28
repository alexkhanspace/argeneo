import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import { errorMessage } from '../../api/client'
import { listMonth, listMyEtablissements } from '../../api/daily'
import { listArticles } from '../../api/costing'
import type { Article, DailyEntry, MyEtablissement } from '../../api/types'
import { aggregate, eur, eur2, intFr, priceMap, todayIso } from '../../dashboard/analytics'
import { buildSeries, defaultRefKey, fetchFrom, windowRange, type Gran } from '../../dashboard/period'
import { widgetDef, type WidgetCtx } from '../../dashboard/widgets'
import { PeriodNav } from '../../dashboard/PeriodNav'
import { PageHeader } from '../../components/PageHeader'

const TODAY = todayIso()

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

/** En-tête de section (synthèse / tendances / détails). */
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

/** Panneau titré réutilisant le rendu d'un widget du registre (graphe ou table). */
function WidgetPanel({ type, ctx, full }: { type: string; ctx: WidgetCtx; full?: boolean }) {
  const def = widgetDef(type)
  if (!def) return null
  return (
    <Box sx={{ gridColumn: full ? { xs: 'span 1', md: '1 / -1' } : 'span 1', minWidth: 0 }}>
      <Card sx={{ height: '100%', minWidth: 0 }}>
        <CardContent sx={{ overflowX: 'hidden' }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
            {def.label}
          </Typography>
          {def.render(ctx)}
        </CardContent>
      </Card>
    </Box>
  )
}

const grid2 = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
  gap: 2,
  alignItems: 'start',
} as const

/** Vue analytique unifiée : synthèse en tête, puis tendances et détails. */
export function AnalyticsPage() {
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [etabId, setEtabId] = useState<number | null>(null)
  const [gran, setGran] = useState<Gran>('mois')
  const [refKey, setRefKey] = useState(() => defaultRefKey('mois', TODAY))
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const window = useMemo(() => windowRange(gran, refKey, TODAY), [gran, refKey])
  useEffect(() => {
    if (etabId == null) return
    let cancelled = false
    void (async () => {
      try {
        // Jusqu'à aujourd'hui (le bloc « jour/veille » reste à jour quelle que soit la période).
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

  const ctx: WidgetCtx = useMemo(() => {
    const price = priceMap(articles)
    const inWindow = entries.filter((e) => e.date >= window.from && e.date <= window.to)
    return { agg: aggregate(inWindow, price), comparison: buildSeries(entries, gran, refKey, TODAY) }
  }, [entries, articles, gran, refKey, window.from, window.to])

  const { agg, comparison: cmp } = ctx

  const onGran = (g: Gran) => {
    setLoading(true)
    setGran(g)
    setRefKey(defaultRefKey(g, TODAY))
  }

  const synthese: { label: string; value: string; sub?: string; accent?: boolean; delta?: number | null }[] = [
    { label: 'CA total', value: eur(agg.totalCA), accent: true, delta: cmp.deltaPct, sub: 'évolution vs N-1' },
    { label: 'CA moyen / jour', value: eur(agg.avgCA), sub: `${intFr(agg.nbDays)} jours saisis` },
    { label: 'Clients', value: intFr(agg.totalClients) },
    { label: 'Ticket moyen', value: eur2(agg.avgTicket) },
    { label: 'Pertes (TTC)', value: eur(agg.lossValue), sub: `${intFr(agg.lossUnits)} unités` },
  ]

  const jourVeille: { label: string; value: string; sub?: string }[] = [
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

  const card = (s: { label: string; value: string; sub?: string; accent?: boolean; delta?: number | null }): ReactNode => (
    <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} accent={s.accent} delta={s.delta} />
  )

  return (
    <>
      <PageHeader
        title="Analytique"
        subtitle="Synthèse, tendances et détails de l'activité — comparés à l'an dernier."
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

      {/* — Synthèse — */}
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

      {/* — Tendances — */}
      <SectionTitle title="Tendances" hint="Évolution sur la période et comparaison à l'an dernier (N vs N-1)." />
      <Box sx={grid2}>
        <WidgetPanel type="ca_line" ctx={ctx} full />
        <WidgetPanel type="compare" ctx={ctx} full />
        <WidgetPanel type="ca_weekday" ctx={ctx} />
        <WidgetPanel type="ticket_month" ctx={ctx} />
      </Box>

      {/* — Détails — */}
      <SectionTitle title="Détails" hint="Récapitulatifs, meilleures journées et analyse des pertes." />
      <Box sx={grid2}>
        <WidgetPanel type="table_month" ctx={ctx} />
        <WidgetPanel type="table_best" ctx={ctx} />
        <WidgetPanel type="loss_pie" ctx={ctx} />
        <WidgetPanel type="table_loss" ctx={ctx} />
      </Box>
    </>
  )
}
