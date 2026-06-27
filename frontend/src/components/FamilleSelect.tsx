import { MenuItem, TextField } from '@mui/material'
import type { Famille } from '../api/types'

interface FamilleSelectProps {
  /** Arborescence des familles du périmètre concerné. */
  familles: Famille[]
  familleId: number | null
  sousFamilleId: number | null
  /** Notifie le parent : changer de famille réinitialise la sous-famille. */
  onChange: (familleId: number | null, sousFamilleId: number | null) => void
}

/**
 * Deux listes dépendantes : famille puis sous-famille (filtrée par la famille choisie).
 * Les deux sont optionnelles ; choisir « — Aucune » détache le classement.
 */
export function FamilleSelect({ familles, familleId, sousFamilleId, onChange }: FamilleSelectProps) {
  const selected = familles.find((f) => f.id === familleId) ?? null
  const sousFamilles = selected?.children ?? []

  return (
    <>
      <TextField
        select
        label="Famille"
        value={familleId == null ? '' : String(familleId)}
        onChange={(e) => {
          const next = e.target.value === '' ? null : Number(e.target.value)
          onChange(next, null) // changer de famille réinitialise la sous-famille
        }}
      >
        <MenuItem value="">
          <em>— Aucune</em>
        </MenuItem>
        {familles.map((f) => (
          <MenuItem key={f.id} value={String(f.id)}>
            {f.name}
          </MenuItem>
        ))}
      </TextField>
      {sousFamilles.length > 0 && (
        <TextField
          select
          label="Sous-famille"
          value={sousFamilleId == null ? '' : String(sousFamilleId)}
          onChange={(e) => onChange(familleId, e.target.value === '' ? null : Number(e.target.value))}
        >
          <MenuItem value="">
            <em>— Aucune</em>
          </MenuItem>
          {sousFamilles.map((sf) => (
            <MenuItem key={sf.id} value={String(sf.id)}>
              {sf.name}
            </MenuItem>
          ))}
        </TextField>
      )}
    </>
  )
}
