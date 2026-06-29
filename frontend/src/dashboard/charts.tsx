import { type ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { ResponsiveLine } from '@nivo/line'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsivePie } from '@nivo/pie'
import { eur, eur2, eurAxis } from './analytics'

// Couleurs N-1 / N raccord à la DA.
const COLOR_PREV = '#cdbba6'
const COLOR_CUR = '#c2410c'

// Thème Nivo : police Inter, libellés gris, hairlines crème — cohérent avec le reste de l'UI.
const nivoTheme = {
  text: { fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11, fill: '#6b7280' },
  axis: {
    ticks: { text: { fontSize: 11, fill: '#6b7280' }, line: { stroke: '#ece9e4' } },
    domain: { line: { stroke: '#ece9e4' } },
  },
  grid: { line: { stroke: '#f1efe9', strokeWidth: 1 } },
  tooltip: {
    container: {
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 12,
      borderRadius: 6,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    },
  },
}

const bottomAxis = (count: number) => ({
  tickSize: 0,
  tickPadding: 6,
  tickRotation: count > 8 ? (-45 as const) : (0 as const),
})
const leftAxis = { tickSize: 0, tickPadding: 6, format: (v: number | string) => eurAxis(Number(v)) }
const lineMargin = (count: number) => ({ top: 8, right: 16, bottom: count > 8 ? 42 : 24, left: 52 })

/** Cadre commun : légende HTML compacte au-dessus + le graphe qui occupe le reste (marges SVG minimes). */
function ChartFrame({
  height = 280,
  legend,
  children,
}: {
  height?: number
  legend?: { label: string; color: string }[]
  children: ReactNode
}) {
  return (
    <Box sx={{ height, width: '100%', display: 'flex', flexDirection: 'column' }}>
      {legend && (
        <Stack direction="row" sx={{ gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
          {legend.map((l) => (
            <Stack key={l.label} direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: l.color, flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary">
                {l.label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Box>
  )
}

/** Courbe N vs N-1 (sable / terracotta), aire optionnelle sur la série courante. */
export function CompareLine({
  labels,
  cur,
  prev,
  curLabel = 'N',
  prevLabel = 'N-1',
  area = false,
  height = 280,
  money2 = false,
}: {
  labels: (string | number)[]
  cur: number[]
  prev: number[]
  curLabel?: string
  prevLabel?: string
  area?: boolean
  height?: number
  money2?: boolean
}) {
  const fmt = money2 ? eur2 : eur
  const data = [
    { id: prevLabel, data: labels.map((x, i) => ({ x, y: Math.round(prev[i] ?? 0) })) },
    { id: curLabel, data: labels.map((x, i) => ({ x, y: Math.round(cur[i] ?? 0) })) },
  ]
  const step = Math.ceil(labels.length / 12)
  const tickValues = step > 1 ? labels.filter((_, i) => i % step === 0) : undefined
  return (
    <ChartFrame
      height={height}
      legend={[
        { label: prevLabel, color: COLOR_PREV },
        { label: curLabel, color: COLOR_CUR },
      ]}
    >
      <ResponsiveLine
        data={data}
        theme={nivoTheme}
        colors={[COLOR_PREV, COLOR_CUR]}
        margin={lineMargin(labels.length)}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 0, max: 'auto' }}
        yFormat={(v) => fmt(Number(v))}
        axisLeft={leftAxis}
        axisBottom={{ ...bottomAxis(labels.length), tickValues }}
        enableGridX={false}
        gridYValues={5}
        curve="monotoneX"
        lineWidth={2.5}
        pointSize={0}
        enableArea={area}
        areaOpacity={0.12}
        useMesh
        enableSlices="x"
        animate={false}
      />
    </ChartFrame>
  )
}

/** Barres groupées N vs N-1. */
export function CompareBar({
  labels,
  cur,
  prev,
  curLabel = 'N',
  prevLabel = 'N-1',
  height = 280,
}: {
  labels: (string | number)[]
  cur: number[]
  prev: number[]
  curLabel?: string
  prevLabel?: string
  height?: number
}) {
  const data = labels.map((l, i) => ({
    label: String(l),
    [prevLabel]: Math.round(prev[i] ?? 0),
    [curLabel]: Math.round(cur[i] ?? 0),
  }))
  return (
    <ChartFrame
      height={height}
      legend={[
        { label: prevLabel, color: COLOR_PREV },
        { label: curLabel, color: COLOR_CUR },
      ]}
    >
      <ResponsiveBar
        data={data}
        theme={nivoTheme}
        keys={[prevLabel, curLabel]}
        indexBy="label"
        groupMode="grouped"
        margin={lineMargin(labels.length)}
        padding={0.25}
        innerPadding={2}
        colors={({ id }: { id: string | number }) => (id === curLabel ? COLOR_CUR : COLOR_PREV)}
        valueFormat={(v) => eur(Number(v))}
        axisLeft={leftAxis}
        axisBottom={bottomAxis(labels.length)}
        enableGridY
        gridYValues={5}
        enableLabel={false}
        animate={false}
      />
    </ChartFrame>
  )
}

/** Camembert (pertes par article). */
export function LossPie({
  data,
  height = 280,
}: {
  data: { id: string; label: string; value: number }[]
  height?: number
}) {
  return (
    <ChartFrame height={height}>
      <ResponsivePie
        data={data}
        theme={nivoTheme}
        margin={{ top: 16, right: 90, bottom: 16, left: 90 }}
        innerRadius={0.55}
        padAngle={1}
        cornerRadius={3}
        activeOuterRadiusOffset={6}
        colors={{ scheme: 'oranges' }}
        borderWidth={1}
        borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
        valueFormat={(v) => eur2(Number(v))}
        arcLinkLabelsSkipAngle={12}
        arcLinkLabelsThickness={1.5}
        arcLinkLabelsColor={{ from: 'color' }}
        arcLabelsSkipAngle={20}
        arcLabelsTextColor="#ffffff"
        animate={false}
      />
    </ChartFrame>
  )
}
