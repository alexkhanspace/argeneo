import { useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight'
import { errorMessage } from '../api/client'
import {
  createFamille,
  deleteFamille,
  listFamilles,
  updateFamille,
} from '../api/costing'
import type { Famille, FamilleScope } from '../api/types'
import { Modal } from './Modal'

interface FamilleManagerProps {
  open: boolean
  scope: FamilleScope
  onClose: () => void
  /** Appelé après toute modification pour que la page rafraîchisse ses familles. */
  onChanged: () => void
}

/**
 * Gestion CRUD des familles et sous-familles d'un périmètre (produits ou matières).
 * Deux niveaux : familles de premier niveau, chacune avec ses sous-familles.
 */
export function FamilleManager({ open, scope, onClose, onChanged }: FamilleManagerProps) {
  const [familles, setFamilles] = useState<Famille[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = () => {
    listFamilles(scope)
      .then((data) => {
        setFamilles(data)
        setError(null)
      })
      .catch((e) => setError(errorMessage(e)))
  }
  useEffect(() => {
    if (open) {
      reload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope])

  /** Exécute une action API, recharge la liste et prévient le parent. */
  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    setBusy(true)
    try {
      await action()
      reload()
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const addFamille = async () => {
    const name = newName.trim()
    if (!name) return
    await run(() => createFamille(scope, { name }))
    setNewName('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Gérer les familles">
      <Stack spacing={2} sx={{ mt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {familles.length === 0 ? (
          <Typography color="text.secondary">
            Aucune famille. Ajoutez-en une ci-dessous pour classer vos éléments.
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1}>
            {familles.map((f) => (
              <FamilleNode
                key={f.id}
                scope={scope}
                famille={f}
                busy={busy}
                onRun={run}
              />
            ))}
          </Stack>
        )}

        <Divider />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            size="small"
            label="Nouvelle famille"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addFamille()
              }
            }}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={busy || !newName.trim()}
            onClick={() => void addFamille()}
          >
            Ajouter
          </Button>
        </Stack>
      </Stack>
    </Modal>
  )
}

/** Une famille de premier niveau, ses sous-familles, et la saisie d'une nouvelle sous-famille. */
function FamilleNode({
  scope,
  famille,
  busy,
  onRun,
}: {
  scope: FamilleScope
  famille: Famille
  busy: boolean
  onRun: (action: () => Promise<unknown>) => Promise<void>
}) {
  const [addingSub, setAddingSub] = useState(false)
  const [subName, setSubName] = useState('')

  const addSub = async () => {
    const name = subName.trim()
    if (!name) return
    await onRun(() => createFamille(scope, { name, parentId: famille.id }))
    setSubName('')
    setAddingSub(false)
  }

  return (
    <Box>
      <EditableRow
        label={famille.name}
        bold
        busy={busy}
        onRename={(name) => onRun(() => updateFamille(scope, famille.id, { name }))}
        onDelete={() => onRun(() => deleteFamille(scope, famille.id))}
        extraAction={
          <IconButton
            size="small"
            aria-label="Ajouter une sous-famille"
            title="Ajouter une sous-famille"
            disabled={busy}
            onClick={() => setAddingSub((v) => !v)}
          >
            <SubdirectoryArrowRightIcon fontSize="small" />
          </IconButton>
        }
      />

      <Stack sx={{ pl: 3 }}>
        {famille.children.map((sf) => (
          <EditableRow
            key={sf.id}
            label={sf.name}
            busy={busy}
            onRename={(name) => onRun(() => updateFamille(scope, sf.id, { name }))}
            onDelete={() => onRun(() => deleteFamille(scope, sf.id))}
          />
        ))}
        {addingSub && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5 }}>
            <TextField
              size="small"
              autoFocus
              placeholder="Nouvelle sous-famille"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addSub()
                }
              }}
              sx={{ flex: 1 }}
            />
            <IconButton size="small" color="primary" disabled={busy || !subName.trim()} onClick={() => void addSub()}>
              <CheckIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => { setAddingSub(false); setSubName('') }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}

/** Ligne avec libellé, édition en ligne (renommage), suppression et action additionnelle. */
function EditableRow({
  label,
  bold,
  busy,
  onRename,
  onDelete,
  extraAction,
}: {
  label: string
  bold?: boolean
  busy: boolean
  onRename: (name: string) => Promise<void> | void
  onDelete: () => Promise<void> | void
  extraAction?: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)

  const save = async () => {
    const name = value.trim()
    if (name && name !== label) {
      await onRename(name)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5 }}>
        <TextField
          size="small"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void save()
            }
          }}
          sx={{ flex: 1 }}
        />
        <IconButton size="small" color="primary" disabled={busy} onClick={() => void save()}>
          <CheckIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => { setEditing(false); setValue(label) }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    )
  }

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', py: 0.5 }}>
      <Typography sx={{ flex: 1, fontWeight: bold ? 600 : 400 }}>{label}</Typography>
      {extraAction}
      <IconButton size="small" aria-label="Renommer" disabled={busy} onClick={() => { setValue(label); setEditing(true) }}>
        <EditIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" color="error" aria-label="Supprimer" disabled={busy} onClick={() => void onDelete()}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Stack>
  )
}
