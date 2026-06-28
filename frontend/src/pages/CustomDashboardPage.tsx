import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { errorMessage } from '../api/client'
import { listMonth, listMyEtablissements } from '../api/daily'
import { listArticles } from '../api/costing'
import { getDashboard, saveDashboard, type DashboardItem, type WidgetSize } from '../api/dashboard'
import type { Article, DailyEntry, MyEtablissement } from '../api/types'
import { aggregate, priceMap, todayIso } from '../dashboard/analytics'
import { WIDGETS, widgetDef, type WidgetCtx } from '../dashboard/widgets'
import { PeriodNav } from '../dashboard/PeriodNav'
import { buildSeries, defaultRefKey, fetchFrom, windowRange, type Gran } from '../dashboard/period'
import { PageHeader } from '../components/PageHeader'

const TODAY = todayIso()

const DEFAULT_ITEMS: DashboardItem[] = [
  { type: 'kpis', size: 'L' },
  { type: 'ca_today', size: 'S' },
  { type: 'compare', size: 'L' },
  { type: 'ca_line', size: 'L' },
  { type: 'ca_weekday', size: 'M' },
  { type: 'ticket_month', size: 'M' },
  { type: 'loss_pie', size: 'M' },
  { type: 'table_best', size: 'M' },
]

const SPAN: Record<WidgetSize, { md: string; lg: string }> = {
  S: { md: 'span 1', lg: 'span 1' },
  M: { md: 'span 2', lg: 'span 2' },
  L: { md: 'span 2', lg: 'span 4' },
}

function SortableWidget({
  item,
  ctx,
  onSize,
  onRemove,
}: {
  item: DashboardItem
  ctx: WidgetCtx
  onSize: (size: WidgetSize) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.type })
  const def = widgetDef(item.type)
  if (!def) return null
  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        gridColumn: { xs: 'span 1', md: SPAN[item.size].md, lg: SPAN[item.size].lg },
        minWidth: 0,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 1 : 'auto',
      }}
    >
      <Card sx={{ height: '100%', minWidth: 0 }}>
        <CardContent sx={{ py: 1.5, overflowX: 'hidden' }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, mb: 1 }}>
            <IconButton
              size="small"
              sx={{ cursor: 'grab', touchAction: 'none' }}
              {...attributes}
              {...listeners}
              aria-label="Déplacer"
            >
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
            <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600 }} noWrap>
              {def.label}
            </Typography>
            <ToggleButtonGroup size="small" exclusive value={item.size} onChange={(_, v) => v && onSize(v as WidgetSize)}>
              <ToggleButton value="S" sx={{ px: 1, py: 0.2 }}>S</ToggleButton>
              <ToggleButton value="M" sx={{ px: 1, py: 0.2 }}>M</ToggleButton>
              <ToggleButton value="L" sx={{ px: 1, py: 0.2 }}>L</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Retirer">
              <IconButton size="small" onClick={onRemove} aria-label="Retirer">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          {def.render(ctx)}
        </CardContent>
      </Card>
    </Box>
  )
}

export function CustomDashboardPage() {
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [etabId, setEtabId] = useState<number | null>(null)
  const [gran, setGran] = useState<Gran>('mois')
  const [refKey, setRefKey] = useState(() => defaultRefKey('mois', TODAY))
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [items, setItems] = useState<DashboardItem[]>(DEFAULT_ITEMS)
  const [loaded, setLoaded] = useState(false)
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
    getDashboard()
      .then((cfg) => {
        if (cfg && cfg.items.length) setItems(cfg.items.filter((i) => widgetDef(i.type)))
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true))
  }, [])

  // Une seule requête couvrant la fenêtre + l'an N-1 (pour la comparaison).
  const window = useMemo(() => windowRange(gran, refKey, TODAY), [gran, refKey])
  useEffect(() => {
    if (etabId == null) return
    let cancelled = false
    void (async () => {
      try {
        const d = await listMonth(etabId, fetchFrom(gran, refKey), window.to)
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
  }, [etabId, gran, refKey, window.to])

  const ctx: WidgetCtx = useMemo(() => {
    const price = priceMap(articles)
    const inWindow = entries.filter((e) => e.date >= window.from && e.date <= window.to)
    return { agg: aggregate(inWindow, price), comparison: buildSeries(entries, gran, refKey, TODAY) }
  }, [entries, articles, gran, refKey, window.from, window.to])

  const persist = (next: DashboardItem[]) => {
    setItems(next)
    if (loaded) saveDashboard({ items: next }).catch(() => undefined)
  }

  // Changer de granularité repositionne sur la période par défaut (J-1 / S-1 / M-1 / année en cours).
  const onGran = (g: Gran) => {
    setLoading(true)
    setGran(g)
    setRefKey(defaultRefKey(g, TODAY))
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldI = items.findIndex((i) => i.type === active.id)
    const newI = items.findIndex((i) => i.type === over.id)
    if (oldI < 0 || newI < 0) return
    persist(arrayMove(items, oldI, newI))
  }

  const present = new Set(items.map((i) => i.type))
  const available = WIDGETS.filter((w) => !present.has(w.type))

  return (
    <>
      <PageHeader title="Mon tableau de bord" />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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

      {available.length > 0 && (
        <Stack direction="row" sx={{ mb: 2, gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">Ajouter un widget :</Typography>
          {available.map((w) => (
            <Chip
              key={w.type}
              icon={<AddIcon />}
              label={w.label}
              size="small"
              variant="outlined"
              onClick={() => persist([...items, { type: w.type, size: w.defaultSize }])}
            />
          ))}
        </Stack>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.type)} strategy={rectSortingStrategy}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            {items.map((item) => (
              <SortableWidget
                key={item.type}
                item={item}
                ctx={ctx}
                onSize={(size) => persist(items.map((i) => (i.type === item.type ? { ...i, size } : i)))}
                onRemove={() => persist(items.filter((i) => i.type !== item.type))}
              />
            ))}
          </Box>
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Aucun widget. Ajoute-en depuis la palette ci-dessus pour composer ton tableau de bord.
        </Typography>
      )}
    </>
  )
}
