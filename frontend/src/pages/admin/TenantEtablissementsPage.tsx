import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import LocationOffIcon from '@mui/icons-material/LocationOff'
import { errorMessage } from '../../api/client'
import {
  createTenantEtablissement,
  listTenantEtablissements,
  listTenants,
  updateTenantEtablissement,
} from '../../api/iam'
import type { Etablissement } from '../../api/types'
import { AddressAutocomplete, type AddressPick } from '../../components/AddressAutocomplete'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'

/** Page dédiée à la gestion des établissements d'un tenant (extrait de la modale Tenants). */
export function TenantEtablissementsPage() {
  const { id } = useParams()
  const tenantId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const stateName = (location.state as { name?: string } | null)?.name
  const [tenantName, setTenantName] = useState(stateName ?? '')
  const [etabs, setEtabs] = useState<Etablissement[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  // Formulaire d'ajout.
  const [addName, setAddName] = useState('')
  const [addAddress, setAddAddress] = useState('')
  const [addLat, setAddLat] = useState<number | null>(null)
  const [addLon, setAddLon] = useState<number | null>(null)
  const [addDescription, setAddDescription] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Modale d'édition.
  const [editTarget, setEditTarget] = useState<Etablissement | null>(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editLat, setEditLat] = useState<number | null>(null)
  const [editLon, setEditLon] = useState<number | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const loadEtabs = () => {
    listTenantEtablissements(tenantId).then(setEtabs).catch((e) => setLoadError(errorMessage(e)))
  }
  useEffect(() => {
    loadEtabs()
    // Si on arrive en accès direct (sans state de navigation), on retrouve le nom du tenant.
    if (!stateName) {
      listTenants()
        .then((ts) => setTenantName(ts.find((t) => t.id === tenantId)?.name ?? ''))
        .catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const onAddPick = (pick: AddressPick | null) => {
    setAddAddress(pick?.label ?? '')
    setAddLat(pick?.latitude ?? null)
    setAddLon(pick?.longitude ?? null)
  }

  const onAdd = async (e: FormEvent) => {
    e.preventDefault()
    setAddError(null)
    setAddBusy(true)
    try {
      await createTenantEtablissement(tenantId, {
        name: addName,
        address: addAddress || undefined,
        latitude: addLat,
        longitude: addLon,
        description: addDescription || undefined,
      })
      setAddName('')
      setAddAddress('')
      setAddLat(null)
      setAddLon(null)
      setAddDescription('')
      loadEtabs()
    } catch (err) {
      setAddError(errorMessage(err))
    } finally {
      setAddBusy(false)
    }
  }

  const openEdit = (b: Etablissement) => {
    setEditTarget(b)
    setEditName(b.name)
    setEditAddress(b.address ?? '')
    setEditLat(b.latitude)
    setEditLon(b.longitude)
    setEditDescription(b.description ?? '')
    setEditError(null)
  }

  const onEditPick = (pick: AddressPick | null) => {
    setEditAddress(pick?.label ?? '')
    setEditLat(pick?.latitude ?? null)
    setEditLon(pick?.longitude ?? null)
  }

  const onEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setEditError(null)
    setEditBusy(true)
    try {
      await updateTenantEtablissement(tenantId, editTarget.id, {
        name: editName,
        address: editAddress || undefined,
        latitude: editLat,
        longitude: editLon,
        description: editDescription || undefined,
      })
      setEditTarget(null)
      loadEtabs()
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setEditBusy(false)
    }
  }

  const noGeo = (b: Etablissement) => b.latitude == null || b.longitude == null

  const columns: GridColDef<Etablissement>[] = [
    {
      field: 'name',
      headerName: 'Établissement',
      flex: 1,
      minWidth: 180,
      renderCell: (p) => (
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <span>{p.row.name}</span>
          {noGeo(p.row) && (
            <Tooltip title="Sans coordonnées : la météo ne s'affichera pas.">
              <Chip
                icon={<LocationOffIcon fontSize="small" />}
                label="sans géoloc"
                size="small"
                variant="outlined"
              />
            </Tooltip>
          )}
        </Stack>
      ),
    },
    {
      field: 'address',
      headerName: 'Adresse',
      flex: 1,
      minWidth: 180,
      valueGetter: (_v, row) => row.address ?? '—',
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 160,
      valueGetter: (_v, row) => row.description ?? '—',
    },
    {
      field: 'actions',
      headerName: '',
      width: 70,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (p) => (
        <Tooltip title="Modifier">
          <IconButton size="small" onClick={() => openEdit(p.row)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={tenantName ? `Établissements — ${tenantName}` : 'Établissements'}
        subtitle={
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/admin/tenants')}
            sx={{ px: 0 }}
          >
            Retour aux tenants
          </Button>
        }
      />

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}

      {/* Ajout d'un établissement */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Ajouter un établissement
          </Typography>
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            onSubmit={onAdd}
            sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' } }}
          >
            <TextField
              label="Nom de l'établissement"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              required
              sx={{ flex: { sm: 2 }, width: { xs: '100%', sm: 'auto' } }}
            />
            <Stack spacing={1.5} sx={{ flex: { sm: 3 }, width: { xs: '100%', sm: 'auto' } }}>
              <AddressAutocomplete
                value={addAddress || null}
                onPick={onAddPick}
                label="Adresse (optionnel)"
              />
              <TextField
                label="Description (type d'établissement, spécialités…)"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
            </Stack>
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddIcon />}
              disabled={addBusy || !addName.trim()}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {addBusy ? '…' : 'Ajouter'}
            </Button>
          </Stack>
          {addError && <Alert severity="error" sx={{ mt: 2 }}>{addError}</Alert>}
        </CardContent>
      </Card>

      {/* Liste des établissements */}
      <Card>
        <CardContent>
          {etabs.length === 0 ? (
            <Typography color="text.secondary">Aucun établissement pour ce tenant.</Typography>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              {etabs.map((b) => (
                <Card key={b.id} variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontWeight: 600 }}>{b.name}</Typography>
                          {noGeo(b) && (
                            <Chip
                              icon={<LocationOffIcon fontSize="small" />}
                              label="sans géoloc"
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                        {b.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {b.description}
                          </Typography>
                        )}
                        {b.address && (
                          <Typography variant="body2" color="text.secondary">
                            {b.address}
                          </Typography>
                        )}
                      </Box>
                      <IconButton size="small" aria-label="Modifier" onClick={() => openEdit(b)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <Box sx={{ height: 520, width: '100%' }}>
              <DataGrid
                rows={etabs}
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

      {/* Édition d'un établissement */}
      <Modal
        open={editTarget != null}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Modifier — ${editTarget.name}` : ''}
      >
        <Stack component="form" spacing={2} onSubmit={onEditSubmit} sx={{ mt: 1 }}>
          <TextField
            label="Nom de l'établissement"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoFocus
          />
          <AddressAutocomplete
            value={editAddress || null}
            onPick={onEditPick}
            label="Adresse (optionnel)"
          />
          <TextField
            label="Description (type d'établissement, spécialités…)"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            multiline
            minRows={2}
          />
          {editError && <Alert severity="error">{editError}</Alert>}
          <Button type="submit" variant="contained" disabled={editBusy || !editName.trim()}>
            {editBusy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </Stack>
      </Modal>
    </>
  )
}
