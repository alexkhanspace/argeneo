import { CircularProgress, IconButton, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { MyEtablissement } from '../api/types'
import { GRANS, keyOf, refLabel, stepKey, type Gran } from './period'

/** Établissement + granularité (Jour/Semaine/Mois/Année) + navigation ◀ ▶ par unité. */
export function PeriodNav({
  etabs,
  etabId,
  onEtab,
  gran,
  onGran,
  refKey,
  onRef,
  today,
  loading,
}: {
  etabs: MyEtablissement[]
  etabId: number | null
  onEtab: (id: number) => void
  gran: Gran
  onGran: (g: Gran) => void
  refKey: string
  onRef: (key: string) => void
  today: string
  loading?: boolean
}) {
  const atPresent = refKey >= keyOf(today, gran)
  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
      <TextField
        select
        size="small"
        label="Établissement"
        value={etabId ?? ''}
        onChange={(e) => onEtab(Number(e.target.value))}
        sx={{ minWidth: 150, flex: { xs: 1, sm: '0 1 auto' } }}
      >
        {etabs.length === 0 && <MenuItem value="">Aucun</MenuItem>}
        {etabs.map((e) => (
          <MenuItem key={e.id} value={e.id}>
            {e.name}
          </MenuItem>
        ))}
      </TextField>

      <ToggleButtonGroup size="small" exclusive value={gran} onChange={(_, v) => v && onGran(v)}>
        {GRANS.map((g) => (
          <ToggleButton key={g.value} value={g.value}>
            {g.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Stack direction="row" sx={{ alignItems: 'center', gap: 0.25 }}>
        <IconButton size="small" onClick={() => onRef(stepKey(refKey, gran, -1))} aria-label="Période précédente">
          <ChevronLeftIcon />
        </IconButton>
        <Typography
          variant="body2"
          sx={{ minWidth: 150, textAlign: 'center', textTransform: 'capitalize', fontWeight: 600 }}
        >
          {refLabel(gran, refKey)}
        </Typography>
        <IconButton
          size="small"
          disabled={atPresent}
          onClick={() => onRef(stepKey(refKey, gran, 1))}
          aria-label="Période suivante"
        >
          <ChevronRightIcon />
        </IconButton>
      </Stack>

      {loading && <CircularProgress size={18} />}
    </Stack>
  )
}
