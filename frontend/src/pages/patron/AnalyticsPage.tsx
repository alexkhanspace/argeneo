import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Card, CardContent, Typography } from '@mui/material'
import { errorMessage } from '../../api/client'
import { listMonth, listMyEtablissements } from '../../api/daily'
import { listArticles } from '../../api/costing'
import type { Article, DailyEntry, MyEtablissement } from '../../api/types'
import { aggregate, compare, priceMap, todayIso, yesterdayIso } from '../../dashboard/analytics'
import { WIDGETS, type WidgetCtx, type WidgetSize } from '../../dashboard/widgets'
import { PeriodBar, type PeriodMode } from '../../dashboard/PeriodBar'
import { PageHeader } from '../../components/PageHeader'

const SPAN: Record<WidgetSize, { md: string; lg: string }> = {
  S: { md: 'span 1', lg: 'span 1' },
  M: { md: 'span 2', lg: 'span 2' },
  L: { md: 'span 2', lg: 'span 4' },
}

/** Vue analytique complète (tous les indicateurs, disposition fixe). */
export function AnalyticsPage() {
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [etabId, setEtabId] = useState<number | null>(null)
  const [mode, setMode] = useState<PeriodMode>('all')
  const [from, setFrom] = useState('2025-01-01')
  const [to, setTo] = useState(yesterdayIso())
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [compEntries, setCompEntries] = useState<DailyEntry[]>([])
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

  const applyMode = (m: PeriodMode) => {
    setMode(m)
    if (m === 'custom') return
    setLoading(true)
    const t = yesterdayIso()
    if (m === 'veille') {
      setFrom(t)
      setTo(t)
      return
    }
    setTo(t)
    if (m === '12m') {
      const d = new Date()
      d.setFullYear(d.getFullYear() - 1)
      setFrom(d.toISOString().slice(0, 10))
    } else if (m === 'year') setFrom(`${new Date().getFullYear()}-01-01`)
    else setFrom('2025-01-01')
  }

  return (
    <>
      <PageHeader title="Analytique" />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <PeriodBar
        etabs={etabs}
        etabId={etabId}
        onEtab={(id) => {
          setLoading(true)
          setEtabId(id)
        }}
        mode={mode}
        onMode={applyMode}
        from={from}
        to={to}
        onFrom={(v) => {
          setMode('custom')
          setLoading(true)
          setFrom(v)
        }}
        onTo={(v) => {
          setMode('custom')
          setLoading(true)
          setTo(v)
        }}
        loading={loading}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {WIDGETS.map((w) => (
          <Box
            key={w.type}
            sx={{ gridColumn: { xs: 'span 1', md: SPAN[w.defaultSize].md, lg: SPAN[w.defaultSize].lg }, minWidth: 0 }}
          >
            <Card sx={{ height: '100%', minWidth: 0 }}>
              <CardContent sx={{ overflowX: 'hidden' }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {w.label}
                </Typography>
                {w.render(ctx)}
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    </>
  )
}
