import { useState } from 'react'
import { IconButton, MenuItem, Stack, TextField } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { createFamille, listFamilles } from '../api/costing'
import type { Famille, FamilleScope } from '../api/types'

const NEW = '__new__'

interface FamilleSelectProps {
  /** Arborescence des familles du périmètre concerné. */
  familles: Famille[]
  familleId: number | null
  sousFamilleId: number | null
  /** Notifie le parent : changer de famille réinitialise la sous-famille. */
  onChange: (familleId: number | null, sousFamilleId: number | null) => void
  /** Permet de créer une famille/sous-famille à la volée (nécessite `scope`). */
  creatable?: boolean
  scope?: FamilleScope
  /** Appelé après création, avec la liste rafraîchie (le parent met à jour `familles`). */
  onFamillesChanged?: (familles: Famille[]) => void
}

/**
 * Deux listes dépendantes : famille puis sous-famille (filtrée par la famille choisie).
 * Optionnellement « créable » : une entrée « ＋ Créer… » permet d'ajouter une famille ou
 * sous-famille sans quitter le formulaire.
 */
export function FamilleSelect({
  familles,
  familleId,
  sousFamilleId,
  onChange,
  creatable,
  scope,
  onFamillesChanged,
}: FamilleSelectProps) {
  const selected = familles.find((f) => f.id === familleId) ?? null
  const sousFamilles = selected?.children ?? []
  const canCreate = Boolean(creatable && scope)

  const [creatingFamille, setCreatingFamille] = useState(false)
  const [newFamille, setNewFamille] = useState('')
  const [creatingSous, setCreatingSous] = useState(false)
  const [newSous, setNewSous] = useState('')
  const [busy, setBusy] = useState(false)

  const doCreateFamille = async () => {
    const name = newFamille.trim()
    if (!name || !scope) return
    setBusy(true)
    try {
      const created = await createFamille(scope, { name })
      onFamillesChanged?.(await listFamilles(scope))
      onChange(created.id, null)
      setNewFamille('')
      setCreatingFamille(false)
    } finally {
      setBusy(false)
    }
  }

  const doCreateSous = async () => {
    const name = newSous.trim()
    if (!name || !scope || familleId == null) return
    setBusy(true)
    try {
      const created = await createFamille(scope, { name, parentId: familleId })
      onFamillesChanged?.(await listFamilles(scope))
      onChange(familleId, created.id)
      setNewSous('')
      setCreatingSous(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <TextField
        select
        label="Famille"
        value={familleId == null ? '' : String(familleId)}
        onChange={(e) => {
          const v = e.target.value
          if (v === NEW) {
            setCreatingFamille(true)
            return
          }
          setCreatingFamille(false)
          onChange(v === '' ? null : Number(v), null)
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
        {canCreate && <MenuItem value={NEW}>＋ Créer une famille…</MenuItem>}
      </TextField>

      {creatingFamille && (
        <CreateRow
          placeholder="Nouvelle famille"
          value={newFamille}
          busy={busy}
          onChange={setNewFamille}
          onConfirm={() => void doCreateFamille()}
          onCancel={() => {
            setCreatingFamille(false)
            setNewFamille('')
          }}
        />
      )}

      {familleId != null && (sousFamilles.length > 0 || canCreate) && (
        <TextField
          select
          label="Sous-famille"
          value={sousFamilleId == null ? '' : String(sousFamilleId)}
          onChange={(e) => {
            const v = e.target.value
            if (v === NEW) {
              setCreatingSous(true)
              return
            }
            setCreatingSous(false)
            onChange(familleId, v === '' ? null : Number(v))
          }}
        >
          <MenuItem value="">
            <em>— Aucune</em>
          </MenuItem>
          {sousFamilles.map((sf) => (
            <MenuItem key={sf.id} value={String(sf.id)}>
              {sf.name}
            </MenuItem>
          ))}
          {canCreate && <MenuItem value={NEW}>＋ Créer une sous-famille…</MenuItem>}
        </TextField>
      )}

      {creatingSous && (
        <CreateRow
          placeholder="Nouvelle sous-famille"
          value={newSous}
          busy={busy}
          onChange={setNewSous}
          onConfirm={() => void doCreateSous()}
          onCancel={() => {
            setCreatingSous(false)
            setNewSous('')
          }}
        />
      )}
    </>
  )
}

/** Saisie en ligne d'un nouveau nom, avec validation/annulation. */
function CreateRow({
  placeholder,
  value,
  busy,
  onChange,
  onConfirm,
  onCancel,
}: {
  placeholder: string
  value: string
  busy: boolean
  onChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <TextField
        size="small"
        autoFocus
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onConfirm()
          }
        }}
        sx={{ flex: 1 }}
      />
      <IconButton size="small" color="primary" disabled={busy || !value.trim()} onClick={onConfirm}>
        <CheckIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={onCancel}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}
