import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
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
import { aggregate, compare, priceMap, todayIso } from '../dashboard/analytics'
import { WIDGETS, widgetDef, type WidgetCtx } from '../dashboard/widgets'
import { PageHeader } from '../components/PageHeader'

const DEFAULT_ITEMS: DashboardItem[] = [
  { type: 'kpis', size: 'L' },
  { type: 'compare', size: 'L' },
  { type: 'ca_month', size: 'M' },
  { type: 'ca_weekday', size: 'M' },
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
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 1 : 'auto',
      }}
    >
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ py: 1.5 }}>
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
  const [from, setFrom] = useState('2025-01-01')
  const [to, setTo] = useState(todayIso())
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [compEntries, setCompEntries] = useState<DailyEntry[]>([])
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

  useEffect(() => {
    if (etabId == null || !from || !to) return
    let cancelled = false
    void (async () => {
      try {
        const d = await listMonth(etabId, from, to)
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
  }, [etabId, from, to])

  useEffect(() => {
    if (etabId == null) return
    const y = new Date().getFullYear()
    let cancelled = false
    void (async () => {
      try {
        const d = await listMonth(etabId, `${y - 1}-01-01`, todayIso())
        if (!cancelled) setCompEntries(d)
      } catch {
        /* non bloquant */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [etabId])

  const ctx: WidgetCtx = useMemo(
    () => ({ agg: aggregate(entries, priceMap(articles)), comparison: compare(compEntries) }),
    [entries, compEntries, articles],
  )

  const persist = (next: DashboardItem[]) => {
    setItems(next)
    if (loaded) saveDashboard({ items: next }).catch(() => undefined)
  }

  const setPreset = (p: 'year' | '12m' | 'all') => {
    setLoading(true)
    if (p === 'year') setFrom(`${new Date().getFullYear()}-01-01`)
    else if (p === '12m') {
      const d = new Date()
      d.setFullYear(d.getFullYear() - 1)
      setFrom(d.toISOString().slice(0, 10))
    } else setFrom('2025-01-01')
    setTo(todayIso())
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
      <PageHeader
        title="Mon tableau de bord"
        action={
          <TextField
            select
            size="small"
            label="Établissement"
            value={etabId ?? ''}
            onChange={(e) => {
              setLoading(true)
              setEtabId(Number(e.target.value))
            }}
            sx={{ minWidth: { xs: '100%', sm: 220 } }}
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

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" onClick={() => setPreset('all')}>Depuis 2025</Button>
        <Button size="small" variant="outlined" onClick={() => setPreset('12m')}>12 derniers mois</Button>
        <Button size="small" variant="outlined" onClick={() => setPreset('year')}>Cette année</Button>
        <TextField type="date" size="small" label="Du" value={from} onChange={(e) => { setLoading(true); setFrom(e.target.value) }} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" size="small" label="Au" value={to} onChange={(e) => { setLoading(true); setTo(e.target.value) }} slotProps={{ inputLabel: { shrink: true } }} />
        {loading && <CircularProgress size={18} />}
      </Stack>

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
