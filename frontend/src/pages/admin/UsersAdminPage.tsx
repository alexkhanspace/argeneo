import { useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import KeyIcon from '@mui/icons-material/Key'
import BlockIcon from '@mui/icons-material/Block'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { errorMessage } from '../../api/client'
import { deactivateUser, listAllUsers, resetUserPassword, setUserRole } from '../../api/iam'
import type { AdminUserRow } from '../../api/types'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'

function roleLabel(r: AdminUserRow['role']): string {
  if (r === 'SUPER_ADMIN') return 'Super-Admin'
  if (r === 'PATRON') return 'Patron'
  return 'Employé'
}

export function UsersAdminPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [listError, setListError] = useState<string | null>(null)

  const [target, setTarget] = useState<AdminUserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listAllUsers().then(setUsers).catch((e) => setListError(errorMessage(e)))
  }
  useEffect(refresh, [])

  const openReset = (u: AdminUserRow) => {
    setTarget(u)
    setNewPassword('')
    setError(null)
    setDone(false)
  }

  const submitReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!target) return
    setError(null)
    setBusy(true)
    try {
      await resetUserPassword(target.kind, target.id, newPassword)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (u: AdminUserRow, role: 'PATRON' | 'EMPLOYE') => {
    const msg =
      role === 'PATRON'
        ? `Promouvoir « ${u.fullName} » PATRON ? Il aura un accès complet (tableau de bord, articles, équipe, facturation…).`
        : `Rétrograder « ${u.fullName} » en employé ? Il perdra l'accès aux pages de gestion.`
    if (!window.confirm(msg)) return
    setListError(null)
    try {
      await setUserRole(u.id, role)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  const handleDeactivate = async (u: AdminUserRow) => {
    if (!window.confirm(`Désactiver « ${u.fullName} » ? La personne ne pourra plus se connecter.`)) return
    setListError(null)
    try {
      await deactivateUser(u.id)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  const columns: GridColDef<AdminUserRow>[] = [
    { field: 'email', headerName: 'E-mail', flex: 1, minWidth: 200 },
    { field: 'fullName', headerName: 'Nom', flex: 1, minWidth: 160 },
    {
      field: 'role',
      headerName: 'Rôle',
      width: 160,
      type: 'singleSelect',
      valueOptions: ['Super-Admin', 'Patron', 'Employé'],
      valueGetter: (_v, row) => roleLabel(row.role),
      renderCell: (p) => (
        <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', height: '100%' }}>
          <Chip label={p.value as string} size="small" variant="outlined" />
          {!p.row.active && <Chip label="Inactif" color="error" size="small" variant="outlined" />}
        </Stack>
      ),
    },
    {
      field: 'tenantName',
      headerName: 'Enseigne',
      flex: 1,
      minWidth: 140,
      valueGetter: (_v, row) => row.tenantName ?? '—',
    },
    {
      field: 'actions',
      headerName: '',
      width: 150,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (p) => (
        <Stack direction="row" sx={{ gap: 0.5, justifyContent: 'flex-end', width: '100%' }}>
          {p.row.kind === 'USER' && p.row.role === 'EMPLOYE' && (
            <Tooltip title="Promouvoir patron">
              <IconButton size="small" color="primary" onClick={() => changeRole(p.row, 'PATRON')}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {p.row.kind === 'USER' && p.row.role === 'PATRON' && (
            <Tooltip title="Rétrograder employé">
              <IconButton size="small" onClick={() => changeRole(p.row, 'EMPLOYE')}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Réinitialiser MDP">
            <IconButton size="small" onClick={() => openReset(p.row)}>
              <KeyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {p.row.kind === 'USER' && p.row.active && (
            <Tooltip title="Désactiver (couper l'accès)">
              <IconButton size="small" color="error" onClick={() => handleDeactivate(p.row)}>
                <BlockIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Utilisateurs"
      />

      {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          {users.length === 0 ? (
            <Typography color="text.secondary">Aucun utilisateur.</Typography>
          ) : (
            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={users}
                columns={columns}
                getRowId={(row) => `${row.kind}-${row.id}`}
                showToolbar
                disableRowSelectionOnClick
                sortingOrder={['asc', 'desc', null]}
                pageSizeOptions={[25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                sx={{ border: 0 }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      <Modal
        open={target != null}
        onClose={() => setTarget(null)}
        title={target ? `Réinitialiser le mot de passe — ${target.email}` : ''}
      >
        {done ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="success">Mot de passe réinitialisé.</Alert>
            <Button variant="contained" onClick={() => setTarget(null)}>
              Fermer
            </Button>
          </Stack>
        ) : (
          <Stack component="form" spacing={2} onSubmit={submitReset} sx={{ mt: 1 }}>
            <TextField
              label="Nouveau mot de passe (8+ caractères)"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              slotProps={{ htmlInput: { minLength: 8 } }}
              required
              autoFocus
            />
            <Typography variant="body2" color="text.secondary">
              Communiquez-le à l'utilisateur ; il pourra le changer après connexion.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? 'Réinitialisation…' : 'Réinitialiser'}
            </Button>
          </Stack>
        )}
      </Modal>
    </>
  )
}
