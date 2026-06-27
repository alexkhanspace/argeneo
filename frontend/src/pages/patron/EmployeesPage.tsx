import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import TuneIcon from '@mui/icons-material/Tune'
import DeleteIcon from '@mui/icons-material/Delete'
import { errorMessage } from '../../api/client'
import { createEmployee, deleteEmployee, listEmployees, updateEmployee } from '../../api/iam'
import type { AppUser } from '../../api/types'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'

export function EmployeesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<AppUser[]>([])
  const [listError, setListError] = useState<string | null>(null)

  // Mobile : liste de cartes (fiches) au lieu du tableau.
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editFullName, setEditFullName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editBusy, setEditBusy] = useState(false)

  const onEdit = (u: AppUser) => {
    setEditId(u.id)
    setEditFullName(u.fullName)
    setEditEmail(u.email)
    setEditError(null)
    setEditOpen(true)
  }

  const onEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (editId == null) return
    setEditError(null)
    setEditBusy(true)
    try {
      await updateEmployee(editId, { fullName: editFullName, email: editEmail })
      setEditOpen(false)
      refresh()
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setEditBusy(false)
    }
  }

  const refresh = () => {
    listEmployees().then(setItems).catch((e) => setListError(errorMessage(e)))
  }
  useEffect(refresh, [])

  const onDelete = async (u: AppUser) => {
    if (!window.confirm(`Supprimer l'employé « ${u.fullName} » ?`)) return
    try {
      await deleteEmployee(u.id)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  const columns: GridColDef<AppUser>[] = [
    { field: 'fullName', headerName: 'Nom', flex: 1, minWidth: 160 },
    {
      field: 'email',
      headerName: 'E-mail',
      flex: 1,
      minWidth: 200,
      renderCell: (p) => (p.row.email ? p.row.email : '—'),
    },
    {
      field: 'actions',
      headerName: '',
      width: 140,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (p) => (
        <Stack direction="row" sx={{ gap: 0.5, justifyContent: 'flex-end', width: '100%' }}>
          <Tooltip title="Modifier">
            <IconButton size="small" onClick={() => onEdit(p.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Permissions">
            <IconButton size="small" onClick={() => navigate(`/employees/${p.row.id}/permissions`)}>
              <TuneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Supprimer">
            <IconButton size="small" color="error" onClick={() => onDelete(p.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ]

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createEmployee({ fullName, email, password })
      setFullName('')
      setEmail('')
      setPassword('')
      setOpen(false)
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Équipe"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
            Nouvel employé
          </Button>
        }
      />

      {listError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {listError}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          {items.length === 0 ? (
            <Typography color="text.secondary">
              Aucun employé. Cliquez sur « + Nouvel employé ».
            </Typography>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              {[...items]
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((u) => (
                  <Card
                    key={u.id}
                    variant="outlined"
                    onClick={() => onEdit(u)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }}>{u.fullName}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                          {u.email || '—'}
                        </Typography>
                      </Box>
                      <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                        <IconButton
                          size="small"
                          aria-label="Modifier"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(u)
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="Permissions"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/employees/${u.id}/permissions`)
                          }}
                        >
                          <TuneIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label="Supprimer"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(u)
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
            </Stack>
          ) : (
            <Box sx={{ height: 560, width: '100%' }}>
              <DataGrid
                rows={items}
                columns={columns}
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

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvel employé">
        <form onSubmit={onSubmit}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nom complet"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
            />
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Mot de passe (8+ car.)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              slotProps={{ htmlInput: { minLength: 8 } }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? 'Création…' : "Créer l'employé"}
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Modifier l'employé">
        <form onSubmit={onEditSubmit}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nom complet"
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              required
              autoFocus
            />
            <TextField
              label="E-mail"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              required
            />
            {editError && <Alert severity="error">{editError}</Alert>}
            <Button type="submit" variant="contained" disabled={editBusy}>
              {editBusy ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  )
}
