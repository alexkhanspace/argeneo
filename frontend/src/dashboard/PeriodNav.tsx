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
    <Stack sx={{ gap: 1.5, mb: 2 }}>
      {/* Établissement + granularité : pleine largeur, côte à côte sur grand écran. */}
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, alignItems: 'stretch' }}>
        <TextField
          select
          size="small"
          label="Établissement"
          value={etabId ?? ''}
          onChange={(e) => onEtab(Number(e.target.value))}
          sx={{ flex: 1 }}
        >
          {etabs.length === 0 && <MenuItem value="">Aucun</MenuItem>}
          {etabs.map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {e.name}
            </MenuItem>
          ))}
        </TextField>

        <ToggleButtonGroup
          fullWidth
          size="small"
          exclusive
          value={gran}
          onChange={(_, v) => v && onGran(v)}
          sx={{ flex: 1 }}
        >
          {GRANS.map((g) => (
            <ToggleButton key={g.value} value={g.value}>
              {g.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {/* Navigateur de période : pleine largeur, flèches aux extrémités, libellé centré. */}
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <IconButton size="small" onClick={() => onRef(stepKey(refKey, gran, -1))} aria-label="Période précédente">
          <ChevronLeftIcon />
        </IconButton>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ textAlign: 'center', textTransform: 'capitalize', fontWeight: 600 }}
            noWrap
          >
            {refLabel(gran, refKey)}
          </Typography>
          {loading && <CircularProgress size={16} />}
        </Stack>
        <IconButton
          size="small"
          disabled={atPresent}
          onClick={() => onRef(stepKey(refKey, gran, 1))}
          aria-label="Période suivante"
        >
          <ChevronRightIcon />
        </IconButton>
      </Stack>
    </Stack>
  )
}
