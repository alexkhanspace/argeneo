/* eslint-disable react-refresh/only-export-components -- registre de widgets : composants + données mélangés volontairement */
import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { BarChart } from '@mui/x-charts/BarChart'
import { LineChart } from '@mui/x-charts/LineChart'
import { PieChart } from '@mui/x-charts/PieChart'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { eur, eur2, eurAxis, intFr, MONTHS_SHORT, WEEKDAYS, type Agg, type Comparison } from './analytics'

const eurTip = (v: number | null): string => (v == null ? '' : eur(v))
const eur2Tip = (v: number | null): string => (v == null ? '' : eur2(v))

export type WidgetSize = 'S' | 'M' | 'L'
export interface WidgetCtx {
  agg: Agg
  comparison: Comparison
}
export interface WidgetDef {
  type: string
  label: string
  defaultSize: WidgetSize
  render: (ctx: WidgetCtx) => ReactNode
}

function KpiBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 120 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Box>
  )
}

const grid = (rows: Record<string, unknown>[], columns: GridColDef[], height = 300) => (
  <Box sx={{ height }}>
    <DataGrid rows={rows} columns={columns} density="compact" hideFooter sx={{ border: 0 }} />
  </Box>
)

export const WIDGETS: WidgetDef[] = [
  {
    type: 'kpis',
    label: 'Indicateurs clés',
    defaultSize: 'L',
    render: ({ agg }) => (
      <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
        <KpiBox label="CA total" value={eur(agg.totalCA)} />
        <KpiBox label="CA moyen / jour" value={eur(agg.avgCA)} />
        <KpiBox label="Clients" value={intFr(agg.totalClients)} />
        <KpiBox label="Ticket moyen" value={eur2(agg.avgTicket)} />
        <KpiBox label="Pertes (TTC)" value={eur(agg.lossValue)} sub={`${intFr(agg.lossUnits)} unités`} />
      </Stack>
    ),
  },
  {
    type: 'ca_today',
    label: "CA du jour",
    defaultSize: 'S',
    render: ({ agg }) => (
      <Stack sx={{ gap: 1 }}>
        <KpiBox label="CA aujourd'hui" value={agg.todayCA == null ? '— (non saisi)' : eur2(agg.todayCA)} />
        <KpiBox label="Clients aujourd'hui" value={agg.todayClients == null ? '—' : intFr(agg.todayClients)} />
      </Stack>
    ),
  },
  {
    type: 'compare',
    label: 'Comparaison N vs N-1 (CA mensuel — écart à date)',
    defaultSize: 'L',
    render: ({ comparison: c }) => (
      <BarChart
        height={280}
        xAxis={[{ scaleType: 'band', data: MONTHS_SHORT }]}
        yAxis={[{ valueFormatter: (v: number) => eurAxis(v) }]}
        series={[
          { data: c.prev, label: String(c.y - 1), color: '#cdbba6', valueFormatter: eurTip },
          { data: c.cur, label: String(c.y), color: '#b5651d', valueFormatter: eurTip },
        ]}
        margin={{ left: 70 }}
      />
    ),
  },
  {
    type: 'ca_month',
    label: "Chiffre d'affaires par mois",
    defaultSize: 'M',
    render: ({ agg }) =>
      agg.months.length ? (
        <BarChart
          height={260}
          xAxis={[{ scaleType: 'band', data: agg.monthLabels }]}
          yAxis={[{ valueFormatter: (v: number) => eurAxis(v) }]}
          series={[{ data: agg.months.map(([, v]) => Math.round(v.ca)), label: 'CA', color: '#b5651d', valueFormatter: eurTip }]}
          margin={{ left: 70 }}
        />
      ) : (
        <Typography color="text.secondary">Aucune donnée.</Typography>
      ),
  },
  {
    type: 'ca_line',
    label: 'Évolution du CA (mensuel)',
    defaultSize: 'M',
    render: ({ agg }) =>
      agg.months.length ? (
        <LineChart
          height={260}
          xAxis={[{ scaleType: 'point', data: agg.monthLabels }]}
          yAxis={[{ valueFormatter: (v: number) => eurAxis(v) }]}
          series={[{ data: agg.months.map(([, v]) => Math.round(v.ca)), label: 'CA', color: '#b5651d', area: true, valueFormatter: eurTip }]}
          margin={{ left: 70 }}
        />
      ) : (
        <Typography color="text.secondary">Aucune donnée.</Typography>
      ),
  },
  {
    type: 'ca_weekday',
    label: 'CA moyen par jour de semaine',
    defaultSize: 'M',
    render: ({ agg }) => (
      <BarChart
        height={260}
        xAxis={[{ scaleType: 'band', data: WEEKDAYS }]}
        yAxis={[{ valueFormatter: (v: number) => eurAxis(v) }]}
        series={[{ data: agg.weekdayAvg, label: 'CA moyen', color: '#9a5417', valueFormatter: eurTip }]}
        margin={{ left: 70 }}
      />
    ),
  },
  {
    type: 'ticket_month',
    label: 'Ticket moyen par mois',
    defaultSize: 'M',
    render: ({ agg }) =>
      agg.months.length ? (
        <LineChart
          height={260}
          xAxis={[{ scaleType: 'point', data: agg.monthLabels }]}
          yAxis={[{ valueFormatter: (v: number) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} €` }]}
          series={[
            {
              data: agg.months.map(([, v]) => (v.clients ? Number((v.ca / v.clients).toFixed(2)) : 0)),
              label: 'Ticket moyen',
              color: '#2e7d32',
              area: true,
              valueFormatter: eur2Tip,
            },
          ]}
        />
      ) : (
        <Typography color="text.secondary">Aucune donnée.</Typography>
      ),
  },
  {
    type: 'loss_pie',
    label: 'Pertes par article (valeur)',
    defaultSize: 'M',
    render: ({ agg }) =>
      agg.lossByArticle.length ? (
        <PieChart
          height={260}
          series={[
            {
              data: agg.lossByArticle.map((l, i) => ({ id: i, value: Number(l.value.toFixed(2)), label: l.name })),
              valueFormatter: (item) => eur2(item.value),
              highlightScope: { fade: 'global', highlight: 'item' },
            },
          ]}
        />
      ) : (
        <Typography color="text.secondary">Aucune perte.</Typography>
      ),
  },
  {
    type: 'table_month',
    label: 'Récapitulatif mensuel',
    defaultSize: 'M',
    render: ({ agg }) =>
      grid(
        agg.months.map(([k, v], i) => ({
          id: k,
          mois: agg.monthLabels[i],
          ca: v.ca,
          clients: v.clients,
          ticket: v.clients ? v.ca / v.clients : 0,
          loss: v.loss,
        })),
        [
          { field: 'mois', headerName: 'Mois', flex: 1, minWidth: 90 },
          { field: 'ca', headerName: 'CA', width: 100, type: 'number', valueFormatter: (v) => eur(v as number) },
          { field: 'clients', headerName: 'Clients', width: 90, type: 'number' },
          { field: 'ticket', headerName: 'Ticket', width: 90, type: 'number', valueFormatter: (v) => eur2(v as number) },
          { field: 'loss', headerName: 'Pertes', width: 90, type: 'number', valueFormatter: (v) => eur(v as number) },
        ],
      ),
  },
  {
    type: 'table_best',
    label: 'Top 10 des meilleures journées',
    defaultSize: 'M',
    render: ({ agg }) =>
      grid(
        agg.best.map((e) => ({
          id: e.date,
          date: e.date,
          ca: e.revenue ?? 0,
          clients: e.clientCount ?? 0,
          ticket: e.clientCount ? (e.revenue ?? 0) / e.clientCount : 0,
        })),
        [
          {
            field: 'date',
            headerName: 'Date',
            flex: 1,
            minWidth: 110,
            valueFormatter: (v) =>
              new Date(v as string).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }),
          },
          { field: 'ca', headerName: 'CA', width: 100, type: 'number', valueFormatter: (v) => eur(v as number) },
          { field: 'clients', headerName: 'Clients', width: 90, type: 'number' },
        ],
      ),
  },
  {
    type: 'table_loss',
    label: 'Pertes par article',
    defaultSize: 'S',
    render: ({ agg }) =>
      grid(
        agg.lossByArticle.map((l) => ({ id: l.name, name: l.name, qty: l.qty, value: l.value })),
        [
          { field: 'name', headerName: 'Article', flex: 1, minWidth: 120 },
          { field: 'qty', headerName: 'Qté', width: 80, type: 'number', valueFormatter: (v) => intFr(v as number) },
          { field: 'value', headerName: 'Valeur', width: 110, type: 'number', valueFormatter: (v) => eur2(v as number) },
        ],
      ),
  },
]

export const widgetDef = (type: string): WidgetDef | undefined => WIDGETS.find((w) => w.type === type)
