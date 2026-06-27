import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import LoginIcon from '@mui/icons-material/Login'
import StoreIcon from '@mui/icons-material/Store'
import EditIcon from '@mui/icons-material/Edit'
import ArchiveIcon from '@mui/icons-material/Archive'
import UnarchiveIcon from '@mui/icons-material/Unarchive'
import { errorMessage } from '../../api/client'
import {
  archiveTenant,
  createTenant,
  listTenants,
  restoreTenant,
  updateTenant,
} from '../../api/iam'
import type { RecipeScope, Tenant } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { homePathFor } from '../../auth/roles'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'

export function TenantsPage() {
  const { enterTenant } = useAuth()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [recipeScope, setRecipeScope] = useState<RecipeScope>('ENSEIGNE')
  const [patronFullName, setPatronFullName] = useState('')
  const [patronEmail, setPatronEmail] = useState('')
  const [patronPassword, setPatronPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Modale d'édition d'un tenant.
  const [editTarget, setEditTarget] = useState<Tenant | null>(null)
  const [editName, setEditName] = useState('')
  const [editRecipeScope, setEditRecipeScope] = useState<RecipeScope>('ENSEIGNE')
  const [editError, setEditError] = useState<string | null>(null)
  const [editBusy, setEditBusy] = useState(false)

  const refresh = () => {
    listTenants().then(setTenants).catch((e) => setError(errorMessage(e)))
  }
  useEffect(refresh, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setBusy(true)
    try {
      await createTenant({ name, recipeScope, patronEmail, patronPassword, patronFullName })
      setName('')
      setPatronFullName('')
      setPatronEmail('')
      setPatronPassword('')
      setCreateOpen(false)
      refresh()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onEnter = async (t: Tenant) => {
    try {
      const me = await enterTenant(t.id)
      navigate(homePathFor(me))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Gestion des établissements : page dédiée (on passe le nom via le state de navigation).
  const goEtabs = (t: Tenant) => {
    navigate(`/admin/tenants/${t.id}/etablissements`, { state: { name: t.name } })
  }

  const openEdit = (t: Tenant) => {
    setEditTarget(t)
    setEditName(t.name)
    setEditRecipeScope(t.recipeScope)
    setEditError(null)
  }

  const onEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setEditError(null)
    setEditBusy(true)
    try {
      await updateTenant(editTarget.id, { name: editName, recipeScope: editRecipeScope })
      setEditTarget(null)
      refresh()
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setEditBusy(false)
    }
  }

  const onArchive = async (t: Tenant) => {
    if (
      !window.confirm(
        'Archiver « ' + t.name + ' » ? Les utilisateurs de ce tenant ne pourront plus se connecter.',
      )
    )
      return
    try {
      await archiveTenant(t.id)
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const onRestore = async (t: Tenant) => {
    try {
      await restoreTenant(t.id)
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Boutons d'action partagés entre le tableau (desktop) et les cartes (mobile).
  const renderActions = (t: Tenant) => (
    <Stack direction="row" sx={{ gap: 0.5, justifyContent: 'flex-end', width: '100%' }}>
      <Tooltip title="Accéder">
        <span>
          <IconButton size="small" onClick={() => onEnter(t)} disabled={!t.active}>
            <LoginIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Établissements">
        <IconButton size="small" onClick={() => goEtabs(t)}>
          <StoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Modifier">
        <IconButton size="small" onClick={() => openEdit(t)}>
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {t.active ? (
        <Tooltip title="Archiver">
          <IconButton size="small" color="warning" onClick={() => onArchive(t)}>
            <ArchiveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="Réactiver">
          <IconButton size="small" color="success" onClick={() => onRestore(t)}>
            <UnarchiveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  )

  const columns: GridColDef<Tenant>[] = [
    { field: 'id', headerName: '#', width: 70, type: 'number' },
    { field: 'name', headerName: 'Enseigne', flex: 1, minWidth: 180 },
    {
      field: 'recipeScope',
      headerName: 'Recettes',
      width: 160,
      type: 'singleSelect',
      valueOptions: ['Enseigne', 'Par établissement'],
      valueGetter: (_v, row) => (row.recipeScope === 'ENSEIGNE' ? 'Enseigne' : 'Par établissement'),
    },
    {
      field: 'active',
      headerName: 'Statut',
      width: 120,
      type: 'singleSelect',
      valueOptions: ['Actif', 'Archivé'],
      valueGetter: (_v, row) => (row.active ? 'Actif' : 'Archivé'),
      renderCell: (p) =>
        p.row.active ? (
          <Chip label="Actif" color="success" size="small" variant="outlined" />
        ) : (
          <Chip label="Archivé" color="warning" size="small" />
        ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 180,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (p) => renderActions(p.row),
    },
  ]

  return (
    <>
      <PageHeader
        title="Tenants"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Nouveau tenant
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          {tenants.length === 0 ? (
            <Typography color="text.secondary">Aucun tenant. Cliquez sur « Nouveau tenant ».</Typography>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              {[...tenants]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <Card key={t.id} variant="outlined">
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          #{t.id}
                        </Box>
                        <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{t.name}</Typography>
                        {t.active ? (
                          <Chip label="Actif" color="success" size="small" variant="outlined" />
                        ) : (
                          <Chip label="Archivé" color="warning" size="small" />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Recettes : {t.recipeScope === 'ENSEIGNE' ? 'Enseigne' : 'Par établissement'}
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>{renderActions(t)}</Box>
                    </CardContent>
                  </Card>
                ))}
            </Stack>
          ) : (
            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={tenants}
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

      {/* Création de tenant */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau tenant">
        <Stack component="form" spacing={2} onSubmit={onSubmit} sx={{ mt: 1 }}>
          <TextField
            label="Nom de l'enseigne"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <TextField
            select
            label="Portée des recettes"
            value={recipeScope}
            onChange={(e) => setRecipeScope(e.target.value as RecipeScope)}
          >
            <MenuItem value="ENSEIGNE">Communes à l'enseigne</MenuItem>
            <MenuItem value="ETABLISSEMENT">Propres à chaque établissement</MenuItem>
          </TextField>
          <Divider />
          <Typography variant="body2" color="text.secondary">Patron du tenant</Typography>
          <TextField
            label="Nom complet"
            value={patronFullName}
            onChange={(e) => setPatronFullName(e.target.value)}
            required
          />
          <TextField
            label="E-mail"
            type="email"
            value={patronEmail}
            onChange={(e) => setPatronEmail(e.target.value)}
            required
          />
          <TextField
            label="Mot de passe (8+ car.)"
            type="password"
            value={patronPassword}
            onChange={(e) => setPatronPassword(e.target.value)}
            slotProps={{ htmlInput: { minLength: 8 } }}
            required
          />
          {formError && <Alert severity="error">{formError}</Alert>}
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Création…' : 'Créer le tenant'}
          </Button>
        </Stack>
      </Modal>

      {/* Édition de tenant */}
      <Modal
        open={editTarget != null}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Modifier — ${editTarget.name}` : ''}
      >
        <Stack component="form" spacing={2} onSubmit={onEditSubmit} sx={{ mt: 1 }}>
          <TextField
            label="Nom de l'enseigne"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoFocus
          />
          <TextField
            select
            label="Portée des recettes"
            value={editRecipeScope}
            onChange={(e) => setEditRecipeScope(e.target.value as RecipeScope)}
          >
            <MenuItem value="ENSEIGNE">Communes à l'enseigne</MenuItem>
            <MenuItem value="ETABLISSEMENT">Propres à chaque établissement</MenuItem>
          </TextField>
          {editError && <Alert severity="error">{editError}</Alert>}
          <Button type="submit" variant="contained" disabled={editBusy}>
            {editBusy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </Stack>
      </Modal>
    </>
  )
}
