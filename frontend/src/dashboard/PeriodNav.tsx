import { CircularProgress, IconButton, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { MyEtablissement } from '../api/types'
import { GRANS, keyOf, refLabel, stepKey, type Gran } from './period'

/**
 * Établissement + sélecteur de période : granularité (Jour/Semaine/Mois/Année) avec
 * navigation ◀ ▶, ou « Libre » (plage de dates Du/Au) — le tout dans la même barre.
 */
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
  libre = false,
  onSelectLibre,
  from = '',
  to = '',
  onFrom,
  onTo,
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
  /** Mode « plage de dates libre » actif. */
  libre?: boolean
  /** Appelé quand l'utilisateur choisit « Libre » dans la barre. */
  onSelectLibre?: () => void
  from?: string
  to?: string
  onFrom?: (v: string) => void
  onTo?: (v: string) => void
}) {
  const atPresent = refKey >= keyOf(today, gran)
  return (
    <Stack sx={{ gap: 1.5, mb: 2 }}>
      {/* Établissement + sélecteur (granularités + Libre) : pleine largeur. */}
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
          value={libre ? 'libre' : gran}
          onChange={(_, v: string | null) => {
            if (!v) return
            if (v === 'libre') onSelectLibre?.()
            else onGran(v as Gran)
          }}
          sx={{ flex: 1.3 }}
        >
          {GRANS.map((g) => (
            <ToggleButton key={g.value} value={g.value}>
              {g.label}
            </ToggleButton>
          ))}
          <ToggleButton value="libre">Libre</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {libre ? (
        /* Plage de dates libre : Du / Au. */
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1.5, alignItems: 'center' }}>
          <TextField
            type="date"
            size="small"
            label="Du"
            value={from}
            onChange={(e) => onFrom?.(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: to || today } }}
            sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}
          />
          <TextField
            type="date"
            size="small"
            label="Au"
            value={to}
            onChange={(e) => onTo?.(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: from, max: today } }}
            sx={{ flex: 1, width: { xs: '100%', sm: 'auto' } }}
          />
          {loading && <CircularProgress size={16} />}
        </Stack>
      ) : (
        /* Navigateur de période : flèches aux extrémités, libellé centré. */
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
      )}
    </Stack>
  )
}
