import { CircularProgress, MenuItem, Stack, TextField } from '@mui/material'
import type { MyEtablissement } from '../api/types'

export type PeriodMode = 'veille' | '12m' | 'year' | 'all' | 'custom'

const PERIOD_OPTIONS: { value: PeriodMode; label: string }[] = [
  { value: 'veille', label: 'Veille (hier)' },
  { value: '12m', label: '12 derniers mois' },
  { value: 'year', label: 'Cette année' },
  { value: 'all', label: 'Depuis 2025' },
  { value: 'custom', label: 'Personnalisé…' },
]

/**
 * Barre compacte : établissement + période sur une seule ligne (PC). Les champs de date
 * n'apparaissent qu'en mode « Personnalisé » → reste léger sur mobile.
 */
export function PeriodBar({
  etabs,
  etabId,
  onEtab,
  mode,
  onMode,
  from,
  to,
  onFrom,
  onTo,
  loading,
}: {
  etabs: MyEtablissement[]
  etabId: number | null
  onEtab: (id: number) => void
  mode: PeriodMode
  onMode: (m: PeriodMode) => void
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
  loading?: boolean
}) {
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
      <TextField
        select
        size="small"
        label="Période"
        value={mode}
        onChange={(e) => onMode(e.target.value as PeriodMode)}
        sx={{ minWidth: 150, flex: { xs: 1, sm: '0 1 auto' } }}
      >
        {PERIOD_OPTIONS.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      {mode === 'custom' && (
        <>
          <TextField
            type="date"
            size="small"
            label="Du"
            value={from}
            onChange={(e) => onFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="date"
            size="small"
            label="Au"
            value={to}
            onChange={(e) => onTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </>
      )}
      {loading && <CircularProgress size={18} />}
    </Stack>
  )
}
