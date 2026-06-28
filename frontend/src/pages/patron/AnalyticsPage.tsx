import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Card, CardContent, Typography } from '@mui/material'
import { errorMessage } from '../../api/client'
import { listMonth, listMyEtablissements } from '../../api/daily'
import { listArticles } from '../../api/costing'
import type { Article, DailyEntry, MyEtablissement } from '../../api/types'
import { aggregate, priceMap, todayIso } from '../../dashboard/analytics'
import { buildSeries, defaultRefKey, fetchFrom, windowRange, type Gran } from '../../dashboard/period'
import { WIDGETS, type WidgetCtx, type WidgetSize } from '../../dashboard/widgets'
import { PeriodNav } from '../../dashboard/PeriodNav'
import { PageHeader } from '../../components/PageHeader'

const TODAY = todayIso()

const SPAN: Record<WidgetSize, { md: string; lg: string }> = {
  S: { md: 'span 1', lg: 'span 1' },
  M: { md: 'span 2', lg: 'span 2' },
  L: { md: 'span 2', lg: 'span 4' },
}

/** Vue analytique complète (tous les indicateurs, disposition fixe). */
export function AnalyticsPage() {
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [etabId, setEtabId] = useState<number | null>(null)
  const [gran, setGran] = useState<Gran>('jour')
  const [refKey, setRefKey] = useState(() => defaultRefKey('jour', TODAY))
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
        // Jusqu'à aujourd'hui (le widget « jour/veille » reste à jour quelle que soit la période).
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

  const onGran = (g: Gran) => {
    setLoading(true)
    setGran(g)
    setRefKey(defaultRefKey(g, TODAY))
  }

  return (
    <>
      <PageHeader title="Analytique" />

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
