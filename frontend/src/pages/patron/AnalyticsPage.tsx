import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import { errorMessage } from '../../api/client'
import { listMonth, listMyEtablissements } from '../../api/daily'
import { listArticles } from '../../api/costing'
import type { Article, DailyEntry, MyEtablissement } from '../../api/types'
import { aggregate, eur, eur2, intFr, priceMap, todayIso, WEEKDAYS } from '../../dashboard/analytics'
import { CompareBar, CompareLine } from '../../dashboard/charts'
import {
  bucketRange,
  buildBucketSeries,
  buildFreeSeries,
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
import { useHeaderSettingsSetter } from '../../components/HeaderSettings'
import { useSettings } from '../../settings/SettingsContext'

const TODAY = todayIso()

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
/** Jour de la semaine 0=Lun..6=Dim depuis une date ISO (sans décalage de fuseau). */
const weekdayMon0 = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}
/** Badge d'évolution vs N-1 (vert si en hausse, rouge si en baisse). Cliquable pour révéler les € sous-jacents. */
function Delta({ pct, onClick }: { pct: number | null; onClick?: () => void }) {
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
      onClick={onClick}
      sx={{ fontWeight: 600, cursor: onClick ? 'pointer' : undefined }}
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
  onDeltaClick,
  placeholder,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  delta?: number | null
  onDeltaClick?: () => void
  /** Valeur d'attente (état en attente, ex. liaison caisse) : rendu plus discret. */
  placeholder?: boolean
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, height: '100%' }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </Typography>
        {placeholder ? (
          <Typography
            color="text.secondary"
            sx={{ fontStyle: 'italic', fontWeight: 500, fontSize: { xs: '0.95rem', sm: '1.05rem' }, lineHeight: 1.25 }}
          >
            {value}
          </Typography>
        ) : (
          <Typography
            variant="h4"
            color={accent ? 'primary' : 'text.primary'}
            sx={{ fontWeight: 700, fontSize: { xs: '1.4rem', sm: '1.9rem' }, lineHeight: 1.15 }}
          >
            {value}
          </Typography>
        )}
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 'auto', flexWrap: 'wrap' }}>
          {sub && (
            <Typography variant="caption" color="text.secondary">
              {sub}
            </Typography>
          )}
          {delta !== undefined && <Delta pct={delta} onClick={onDeltaClick} />}
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
  return (
    <Panel title={sub.title} full>
      {sub.kind === 'line' ? (
        <CompareLine
          labels={sub.labels}
          cur={sub.caCur}
          prev={sub.caPrev}
          curLabel={sub.curLabel}
          prevLabel={sub.prevLabel}
          area
          height={300}
        />
      ) : (
        <CompareBar
          labels={sub.labels}
          cur={sub.caCur}
          prev={sub.caPrev}
          curLabel={sub.curLabel}
          prevLabel={sub.prevLabel}
          height={300}
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
  const [gran, setGran] = useState<Gran>('jour')
  const [refKey, setRefKey] = useState(() => defaultRefKey('jour', TODAY))
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Jours de semaine inclus dans l'analyse (0=Lun..6=Dim). Permet d'exclure p. ex. le
  // dimanche pour comparer N/N-1 à périmètre égal quand l'ouverture a changé d'une année sur l'autre.
  const [includedDays, setIncludedDays] = useState<number[]>(ALL_DAYS)
  // Axe de comparaison GLOBAL (partagé avec le tableau de bord / calendrier via les réglages).
  // L'analytique compare toujours au N-1 : « même date » → alignement date à date, sinon jour équivalent.
  const { baseline, setBaseline } = useSettings()
  const compareMode: CompareMode = baseline === 'n1_date' ? 'date' : 'equiv'
  // Sélection de période : navigation par granularité OU plage de dates libre.
  const [periodMode, setPeriodMode] = useState<'nav' | 'libre'>('nav')
  const [freeFrom, setFreeFrom] = useState(`${TODAY.slice(0, 7)}-01`)
  const [freeTo, setFreeTo] = useState(TODAY)
  // Affiche les € derrière l'écart % (clic sur le badge de progression).
  const [deltaOpen, setDeltaOpen] = useState(false)

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
    // On récupère jusqu'à aujourd'hui ET l'an N-1 (pour les comparaisons).
    const start =
      periodMode === 'libre' ? `${Number(freeFrom.slice(0, 4)) - 1}-01-01` : fetchFrom(gran, refKey)
    void (async () => {
      try {
        const d = await listMonth(etabId, start, TODAY)
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
  }, [etabId, gran, refKey, periodMode, freeFrom])

  // Saisie filtrée des jours de semaine exclus (mêmes jours retirés des deux années
  // → comparaison N/N-1 honnête). Tous les calculs en aval partent de cette base.
  const fEntries = useMemo(() => {
    if (includedDays.length === ALL_DAYS.length) return entries
    const keep = new Set(includedDays)
    return entries.filter((e) => keep.has(weekdayMon0(e.date)))
  }, [entries, includedDays])

  // Agrégat de la période active (bucket choisi OU plage libre) → les KPI collent au sélecteur.
  const bucketAgg = useMemo(() => {
    const price = priceMap(articles)
    const { from, to } =
      periodMode === 'libre' ? { from: freeFrom, to: freeTo } : bucketRange(gran, refKey, TODAY)
    return aggregate(
      fEntries.filter((e) => e.date >= from && e.date <= to),
      price,
    )
  }, [fEntries, articles, gran, refKey, periodMode, freeFrom, freeTo])

  // Séries N vs N-1 : fenêtre glissante (vue d'ensemble) + détail interne de la période.
  const cmp = useMemo(
    () => buildSeries(fEntries, gran, refKey, TODAY, compareMode, includedDays),
    [fEntries, gran, refKey, compareMode, includedDays],
  )
  const navSub = useMemo(
    () => buildBucketSeries(fEntries, gran, refKey, compareMode, includedDays),
    [fEntries, gran, refKey, compareMode, includedDays],
  )
  const free = useMemo(
    () => buildFreeSeries(fEntries, freeFrom, freeTo, compareMode, includedDays),
    [fEntries, freeFrom, freeTo, compareMode, includedDays],
  )
  // Détail jour par jour + base de l'écart % : selon le mode de période.
  const sub = periodMode === 'libre' ? free.sub : navSub
  const ref = periodMode === 'libre' ? free : cmp

  // Les widgets « détail » lisent agg (= période choisie) ; les widgets « tendance » lisent comparison.
  const ctx: WidgetCtx = useMemo(() => ({ agg: bucketAgg, comparison: cmp }), [bucketAgg, cmp])

  const onGran = (g: Gran) => {
    setLoading(true)
    setPeriodMode('nav')
    setGran(g)
    setRefKey(defaultRefKey(g, TODAY))
  }

  // Réglages contextuels de la page, injectés dans la roue crantée du header (gain de place).
  const setHeaderSettings = useHeaderSettingsSetter()
  // Nettoyage au démontage uniquement (évite un null/remontage à chaque changement de réglage).
  useEffect(() => () => setHeaderSettings(null), [setHeaderSettings])
  useEffect(() => {
    setHeaderSettings({
      hideGlobal: true,
      content: (
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Comparaison (tout le site)
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            orientation="vertical"
            fullWidth
            value={baseline}
            onChange={(_, v: typeof baseline | null) => v && setBaseline(v)}
          >
            <ToggleButton value="habituel">Jour normal</ToggleButton>
            <ToggleButton value="n1_equiv">N‑1 · même jour</ToggleButton>
            <ToggleButton value="n1_date">N‑1 · même date</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Jours analysés
          </Typography>
          <ToggleButtonGroup size="small" value={includedDays}>
            {WEEKDAYS.map((d, i) => (
              <ToggleButton
                key={d}
                value={i}
                selected={includedDays.includes(i)}
                sx={{ px: 1 }}
                // Bascule par mise à jour FONCTIONNELLE (indépendante de la valeur figée du
                // snapshot des réglages) → la sélection reste fiable, sans màj intermittente.
                onClick={() =>
                  setIncludedDays((prev) => {
                    const has = prev.includes(i)
                    if (has && prev.length === 1) return prev // garder au moins un jour
                    const next = has ? prev.filter((x) => x !== i) : [...prev, i]
                    return next.sort((a, b) => a - b)
                  })
                }
              >
                {d}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Stack>
      ),
    })
  }, [baseline, setBaseline, includedDays, setHeaderSettings])

  type Stat = {
    label: string
    value: string
    sub?: string
    accent?: boolean
    delta?: number | null
    onDeltaClick?: () => void
    placeholder?: boolean
  }
  const caDiff = ref.curRef - ref.prevRef
  const synthese: Stat[] = [
    {
      label: 'CA total',
      value: eur(bucketAgg.totalCA),
      accent: true,
      delta: ref.deltaPct,
      onDeltaClick: ref.deltaPct != null ? () => setDeltaOpen((o) => !o) : undefined,
      sub:
        ref.deltaPct == null
          ? undefined
          : deltaOpen
            ? `N-1 ${eur(ref.prevRef)} · ${caDiff >= 0 ? '+' : ''}${eur(caDiff)}`
            : 'vs même période N-1',
    },
    { label: 'CA moyen / jour', value: eur(bucketAgg.avgCA), sub: `${intFr(bucketAgg.nbDays)} jours saisis` },
    { label: 'Clients', value: intFr(bucketAgg.totalClients) },
    { label: 'Ticket moyen', value: eur2(bucketAgg.avgTicket) },
    { label: 'Pertes (TTC)', value: eur(bucketAgg.lossValue), sub: `${intFr(bucketAgg.lossUnits)} unités` },
  ]

  const jourVeille: Stat[] = [
    {
      label: 'CA temps réel',
      // Pas encore de liaison caisse (POS) : on affiche l'attente plutôt qu'une valeur.
      value: 'Attente liaison caisse',
      placeholder: true,
    },
    {
      label: 'CA de la veille',
      value: cmp.yesterdayCA == null ? '—' : eur2(cmp.yesterdayCA),
      sub: cmp.yesterdayClients != null ? `${intFr(cmp.yesterdayClients)} clients` : undefined,
    },
  ]

  const card = (s: Stat): ReactNode => (
    <StatCard
      key={s.label}
      label={s.label}
      value={s.value}
      sub={s.sub}
      accent={s.accent}
      delta={s.delta}
      onDeltaClick={s.onDeltaClick}
      placeholder={s.placeholder}
    />
  )

  return (
    <>
      <PageHeader
        title="Analytique"
        action={
          <TextField
            select
            size="small"
            label="Établissement"
            fullWidth={false}
            value={etabId ?? ''}
            onChange={(e) => {
              setLoading(true)
              setEtabId(Number(e.target.value))
            }}
            sx={{ minWidth: 200 }}
          >
            {etabs.length === 0 && <MenuItem value="">Aucun</MenuItem>}
            {etabs.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name}
              </MenuItem>
            ))}
          </TextField>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <PeriodNav
        gran={gran}
        onGran={onGran}
        refKey={refKey}
        onRef={(k) => {
          setLoading(true)
          setRefKey(k)
        }}
        today={TODAY}
        loading={loading}
        libre={periodMode === 'libre'}
        onSelectLibre={() => {
          setLoading(true)
          setPeriodMode('libre')
        }}
        from={freeFrom}
        to={freeTo}
        onFrom={(v) => {
          setLoading(true)
          setFreeFrom(v)
        }}
        onTo={(v) => setFreeTo(v)}
      />

      {/* Rappel compact des réglages d'analyse (configurables via la roue crantée du header). */}
      {(compareMode === 'date' || includedDays.length < ALL_DAYS.length) && (
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
          {compareMode === 'date' && (
            <Chip size="small" variant="outlined" label="Comparaison N-1 : date à date" />
          )}
          {includedDays.length < ALL_DAYS.length && (
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`${ALL_DAYS.filter((d) => !includedDays.includes(d)).map((d) => WEEKDAYS[d]).join(', ')} exclu(s)`}
            />
          )}
        </Stack>
      )}

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

      {/* — Vue d'ensemble (fenêtre glissante) — uniquement en mode navigation — */}
      {periodMode === 'nav' && (
        <>
          <SectionTitle title="Vue d'ensemble" hint="Tendances sur la fenêtre récente, comparées à l'an dernier." />
          <Box sx={grid2}>
            <WidgetPanel type="ca_line" ctx={ctx} full />
            <WidgetPanel type="ca_weekday" ctx={ctx} />
            <WidgetPanel type="ticket_month" ctx={ctx} />
          </Box>
        </>
      )}
    </>
  )
}
