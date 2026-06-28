import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { LineChart } from '@mui/x-charts/LineChart'
import { PieChart } from '@mui/x-charts/PieChart'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { errorMessage } from '../../api/client'
import { listMonth, listMyEtablissements } from '../../api/daily'
import { listArticles } from '../../api/costing'
import type { Article, DailyEntry, MyEtablissement } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'

const eur = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const eur2 = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const intFr = (v: number): string => Math.round(v).toLocaleString('fr-FR')

const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const todayIso = (): string => new Date().toISOString().slice(0, 10)
/** Jour de la semaine 0=Lun..6=Dim depuis une date ISO (sans décalage de fuseau). */
const weekdayMon0 = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

export function AnalyticsPage() {
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [etabId, setEtabId] = useState<number | null>(null)
  const [from, setFrom] = useState('2025-01-01')
  const [to, setTo] = useState(todayIso())
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

  // Raccourcis de période (mettent à jour from/to ; les champs date permettent le sur-mesure).
  const setPreset = (p: 'year' | '12m' | 'all') => {
    setLoading(true)
    const t = todayIso()
    if (p === 'year') setFrom(`${new Date().getFullYear()}-01-01`)
    else if (p === '12m') {
      const d = new Date()
      d.setFullYear(d.getFullYear() - 1)
      setFrom(d.toISOString().slice(0, 10))
    } else setFrom('2025-01-01')
    setTo(t)
  }

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

  // Comparaison année courante vs précédente : on charge les 2 années pleines.
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

  const priceById = useMemo(() => {
    const m = new Map<number, number>()
    articles.forEach((a) => m.set(a.id, a.salePriceTtc ?? 0))
    return m
  }, [articles])

  // Agrégations.
  const data = useMemo(() => {
    const days = entries.filter((e) => e.revenue != null)
    const totalCA = days.reduce((s, e) => s + (e.revenue ?? 0), 0)
    const totalClients = days.reduce((s, e) => s + (e.clientCount ?? 0), 0)
    const nbDays = days.length

    // Pertes valorisées (quantité × prix de vente TTC).
    let lossValue = 0
    let lossUnits = 0
    const lossByArticle = new Map<string, { qty: number; value: number }>()
    for (const e of entries) {
      for (const l of e.losses ?? []) {
        const val = l.quantity * (priceById.get(l.articleId) ?? 0)
        lossValue += val
        lossUnits += l.quantity
        const cur = lossByArticle.get(l.articleName) ?? { qty: 0, value: 0 }
        cur.qty += l.quantity
        cur.value += val
        lossByArticle.set(l.articleName, cur)
      }
    }

    // Par mois (YYYY-MM).
    const byMonth = new Map<string, { ca: number; clients: number; loss: number; days: number }>()
    for (const e of entries) {
      const key = e.date.slice(0, 7)
      const cur = byMonth.get(key) ?? { ca: 0, clients: 0, loss: 0, days: 0 }
      cur.ca += e.revenue ?? 0
      cur.clients += e.clientCount ?? 0
      cur.days += e.revenue != null ? 1 : 0
      for (const l of e.losses ?? []) cur.loss += l.quantity * (priceById.get(l.articleId) ?? 0)
      byMonth.set(key, cur)
    }
    const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))

    // Par jour de semaine (CA moyen).
    const wd = WEEKDAYS.map(() => ({ ca: 0, n: 0 }))
    for (const e of days) {
      const i = weekdayMon0(e.date)
      wd[i].ca += e.revenue ?? 0
      wd[i].n += 1
    }

    const best = [...days].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0)).slice(0, 10)

    return {
      totalCA,
      totalClients,
      nbDays,
      avgCA: nbDays ? totalCA / nbDays : 0,
      avgTicket: totalClients ? totalCA / totalClients : 0,
      lossValue,
      lossUnits,
      months,
      monthLabels: months.map(([k]) => {
        const [y, m] = k.split('-')
        return `${MONTHS_SHORT[Number(m) - 1]} ${y.slice(2)}`
      }),
      weekdayAvg: wd.map((w) => (w.n ? Math.round(w.ca / w.n) : 0)),
      lossByArticle: [...lossByArticle.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.value - a.value),
      best,
    }
  }, [entries, priceById])

  // Comparaison CA mensuel : année courante (N) vs précédente (N-1).
  const comparison = useMemo(() => {
    const y = new Date().getFullYear()
    const cur = Array(12).fill(0)
    const prev = Array(12).fill(0)
    for (const e of compEntries) {
      const yr = Number(e.date.slice(0, 4))
      const mo = Number(e.date.slice(5, 7)) - 1
      if (yr === y) cur[mo] += e.revenue ?? 0
      else if (yr === y - 1) prev[mo] += e.revenue ?? 0
    }
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)
    return {
      y,
      cur: cur.map((v) => Math.round(v)),
      prev: prev.map((v) => Math.round(v)),
      deltaPct: sum(prev) > 0 ? ((sum(cur) - sum(prev)) / sum(prev)) * 100 : null,
    }
  }, [compEntries])

  const kpi = (label: string, value: string, sub?: string) => (
    <Card sx={{ flex: 1, minWidth: 150 }}>
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  )

  const monthCols: GridColDef[] = [
    { field: 'mois', headerName: 'Mois', flex: 1, minWidth: 110 },
    { field: 'ca', headerName: 'CA', width: 120, type: 'number', valueFormatter: (v) => eur(v as number) },
    { field: 'clients', headerName: 'Clients', width: 100, type: 'number', valueFormatter: (v) => intFr(v as number) },
    { field: 'ticket', headerName: 'Ticket moy.', width: 110, type: 'number', valueFormatter: (v) => eur2(v as number) },
    { field: 'loss', headerName: 'Pertes', width: 110, type: 'number', valueFormatter: (v) => eur(v as number) },
  ]
  const monthRows = data.months.map(([k, v], i) => ({
    id: k,
    mois: data.monthLabels[i],
    ca: v.ca,
    clients: v.clients,
    ticket: v.clients ? v.ca / v.clients : 0,
    loss: v.loss,
  }))

  const bestCols: GridColDef[] = [
    { field: 'date', headerName: 'Date', flex: 1, minWidth: 120, valueFormatter: (v) => new Date(v as string).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' }) },
    { field: 'ca', headerName: 'CA', width: 110, type: 'number', valueFormatter: (v) => eur(v as number) },
    { field: 'clients', headerName: 'Clients', width: 100, type: 'number' },
    { field: 'ticket', headerName: 'Ticket', width: 100, type: 'number', valueFormatter: (v) => eur2(v as number) },
  ]
  const bestRows = data.best.map((e) => ({
    id: e.date,
    date: e.date,
    ca: e.revenue ?? 0,
    clients: e.clientCount ?? 0,
    ticket: e.clientCount ? (e.revenue ?? 0) / e.clientCount : 0,
  }))

  const lossCols: GridColDef[] = [
    { field: 'name', headerName: 'Article', flex: 1, minWidth: 140 },
    { field: 'qty', headerName: 'Qté perdue', width: 110, type: 'number', valueFormatter: (v) => intFr(v as number) },
    { field: 'value', headerName: 'Valeur (TTC)', width: 130, type: 'number', valueFormatter: (v) => eur2(v as number) },
  ]
  const lossRows = data.lossByArticle.map((l) => ({ id: l.name, ...l }))

  return (
    <>
      <PageHeader
        title="Analytique"
        action={
          <TextField
            select
            label="Établissement"
            size="small"
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
        <Button size="small" variant="outlined" onClick={() => setPreset('all')}>
          Depuis 2025
        </Button>
        <Button size="small" variant="outlined" onClick={() => setPreset('12m')}>
          12 derniers mois
        </Button>
        <Button size="small" variant="outlined" onClick={() => setPreset('year')}>
          Cette année
        </Button>
        <TextField
          type="date"
          size="small"
          label="Du"
          value={from}
          onChange={(e) => {
            setLoading(true)
            setFrom(e.target.value)
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          type="date"
          size="small"
          label="Au"
          value={to}
          onChange={(e) => {
            setLoading(true)
            setTo(e.target.value)
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {loading && <CircularProgress size={18} />}
        <Typography variant="caption" color="text.secondary">
          {data.nbDays} jours
        </Typography>
      </Stack>

      {/* KPIs */}
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        {kpi('CA total', eur(data.totalCA))}
        {kpi('CA moyen / jour', eur(data.avgCA))}
        {kpi('Clients', intFr(data.totalClients))}
        {kpi('Ticket moyen', eur2(data.avgTicket))}
        {kpi('Pertes (TTC)', eur(data.lossValue), `${intFr(data.lossUnits)} unités`)}
      </Stack>

      {/* Graphiques */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
        <Card sx={{ gridColumn: { md: '1 / -1' } }}>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Comparaison {comparison.y - 1} vs {comparison.y} — CA mensuel
              </Typography>
              {comparison.deltaPct != null && (
                <Chip
                  size="small"
                  color={comparison.deltaPct >= 0 ? 'success' : 'error'}
                  label={`${comparison.deltaPct >= 0 ? '+' : ''}${comparison.deltaPct.toFixed(1)} % vs ${comparison.y - 1}`}
                />
              )}
            </Stack>
            <BarChart
              height={280}
              xAxis={[{ scaleType: 'band', data: MONTHS_SHORT }]}
              series={[
                { data: comparison.prev, label: String(comparison.y - 1), color: '#cdbba6' },
                { data: comparison.cur, label: String(comparison.y), color: '#b5651d' },
              ]}
              margin={{ left: 70 }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Chiffre d'affaires par mois
            </Typography>
            {data.months.length > 0 ? (
              <BarChart
                height={260}
                xAxis={[{ scaleType: 'band', data: data.monthLabels }]}
                series={[{ data: data.months.map(([, v]) => Math.round(v.ca)), label: 'CA (€)', color: '#b5651d' }]}
                margin={{ left: 70 }}
              />
            ) : (
              <Typography color="text.secondary">Aucune donnée.</Typography>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              CA moyen par jour de semaine
            </Typography>
            <BarChart
              height={260}
              xAxis={[{ scaleType: 'band', data: WEEKDAYS }]}
              series={[{ data: data.weekdayAvg, label: 'CA moyen (€)', color: '#9a5417' }]}
              margin={{ left: 70 }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Ticket moyen par mois
            </Typography>
            {data.months.length > 0 ? (
              <LineChart
                height={260}
                xAxis={[{ scaleType: 'point', data: data.monthLabels }]}
                series={[
                  {
                    data: data.months.map(([, v]) => (v.clients ? Number((v.ca / v.clients).toFixed(2)) : 0)),
                    label: 'Ticket moyen (€)',
                    color: '#2e7d32',
                    area: true,
                  },
                ]}
              />
            ) : (
              <Typography color="text.secondary">Aucune donnée.</Typography>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Pertes par article (valeur TTC)
            </Typography>
            {data.lossByArticle.length > 0 ? (
              <PieChart
                height={260}
                series={[
                  {
                    data: data.lossByArticle.map((l, i) => ({
                      id: i,
                      value: Number(l.value.toFixed(2)),
                      label: l.name,
                    })),
                    highlightScope: { fade: 'global', highlight: 'item' },
                  },
                ]}
              />
            ) : (
              <Typography color="text.secondary">Aucune perte enregistrée.</Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Tableaux */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Récapitulatif mensuel
            </Typography>
            <Box sx={{ height: 360 }}>
              <DataGrid rows={monthRows} columns={monthCols} density="compact" pageSizeOptions={[12, 24]} initialState={{ pagination: { paginationModel: { pageSize: 12 } } }} sx={{ border: 0 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Top 10 des meilleures journées
            </Typography>
            <Box sx={{ height: 360 }}>
              <DataGrid rows={bestRows} columns={bestCols} density="compact" hideFooter sx={{ border: 0 }} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Pertes par article
            </Typography>
            <Box sx={{ height: 320 }}>
              <DataGrid rows={lossRows} columns={lossCols} density="compact" hideFooter sx={{ border: 0 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </>
  )
}
