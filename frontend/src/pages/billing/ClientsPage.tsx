import { useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { errorMessage } from '../../api/client'
import {
  CLIENT_KIND_LABELS,
  createClient,
  deactivateClient,
  listClients,
  updateClient,
  type Client,
  type ClientKind,
} from '../../api/billing'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'

interface FormState {
  name: string
  kind: ClientKind
  siret: string
  tvaIntra: string
  email: string
  phone: string
  address: string
  postalCode: string
  city: string
  country: string
}

const EMPTY_FORM: FormState = {
  name: '',
  kind: 'PRO',
  siret: '',
  tvaIntra: '',
  email: '',
  phone: '',
  address: '',
  postalCode: '',
  city: '',
  country: 'France',
}

export function ClientsPage() {
  const [items, setItems] = useState<Client[]>([])
  const [listError, setListError] = useState<string | null>(null)

  // Mobile : liste de cartes (fiches) au lieu du tableau, avec un tri dédié.
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [mobileSort, setMobileSort] = useState<'name' | 'city'>('name')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listClients().then(setItems).catch((e) => setListError(errorMessage(e)))
  }
  useEffect(refresh, [])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setOpen(true)
  }

  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({
      name: c.name,
      kind: c.kind,
      siret: c.siret ?? '',
      tvaIntra: c.tvaIntra ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      postalCode: c.postalCode ?? '',
      city: c.city ?? '',
      country: c.country ?? 'France',
    })
    setError(null)
    setOpen(true)
  }

  const set = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const onDelete = async (c: Client) => {
    if (!window.confirm(`Désactiver le client « ${c.name} » ?`)) return
    try {
      await deactivateClient(c.id)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const payload = {
      name: form.name,
      kind: form.kind,
      siret: form.kind === 'PRO' ? form.siret || null : null,
      tvaIntra: form.kind === 'PRO' ? form.tvaIntra || null : null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      postalCode: form.postalCode || null,
      city: form.city || null,
      country: form.country || null,
    }
    try {
      if (editing) {
        await updateClient(editing.id, { ...payload, active: editing.active })
      } else {
        await createClient(payload)
      }
      setOpen(false)
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Tri pour la vue cartes mobile (le tableau desktop gère son tri lui-même).
  const sortedMobileItems = [...items].sort((a, b) => {
    if (mobileSort === 'city') return (a.city ?? '').localeCompare(b.city ?? '')
    return a.name.localeCompare(b.name)
  })

  const columns: GridColDef<Client>[] = [
    {
      field: 'name',
      headerName: 'Nom',
      flex: 1,
      minWidth: 180,
      renderCell: (p) => (
        <>
          {p.row.name}
          {!p.row.active && (
            <Chip label="Inactif" size="small" sx={{ ml: 1 }} variant="outlined" />
          )}
        </>
      ),
    },
    {
      field: 'kind',
      headerName: 'Type',
      width: 140,
      type: 'singleSelect',
      valueOptions: Object.values(CLIENT_KIND_LABELS),
      valueGetter: (_v, row) => CLIENT_KIND_LABELS[row.kind],
    },
    {
      field: 'city',
      headerName: 'Ville',
      flex: 1,
      minWidth: 120,
      valueGetter: (_v, row) => row.city ?? '—',
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      minWidth: 180,
      valueGetter: (_v, row) => row.email ?? '—',
    },
    {
      field: 'siret',
      headerName: 'SIRET',
      width: 160,
      valueGetter: (_v, row) => row.siret ?? '—',
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (p) => (
        <Stack direction="row" sx={{ gap: 0.5, justifyContent: 'flex-end', width: '100%' }}>
          <Tooltip title="Modifier">
            <IconButton size="small" onClick={() => openEdit(p.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {p.row.active && (
            <Tooltip title="Désactiver">
              <IconButton size="small" color="error" onClick={() => onDelete(p.row)}>
                <DeleteIcon fontSize="small" />
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
        title="Clients"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Nouveau client
          </Button>
        }
      />

      {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          {items.length === 0 ? (
            <Typography color="text.secondary">
              Aucun client. Cliquez sur « + Nouveau client ».
            </Typography>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              <TextField
                select
                size="small"
                label="Trier par"
                value={mobileSort}
                onChange={(e) => setMobileSort(e.target.value as 'name' | 'city')}
                sx={{ maxWidth: 200 }}
              >
                <MenuItem value="name">Nom</MenuItem>
                <MenuItem value="city">Ville</MenuItem>
              </TextField>
              {sortedMobileItems.map((c) => (
                <Card
                  key={c.id}
                  variant="outlined"
                  onClick={() => openEdit(c)}
                  sx={{ cursor: 'pointer' }}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
                      <Chip label={CLIENT_KIND_LABELS[c.kind]} size="small" variant="outlined" />
                      {!c.active && <Chip label="Inactif" size="small" variant="outlined" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {(c.city ?? '—')} · {(c.email ?? '—')} · {(c.siret ?? '—')}
                    </Typography>
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                      <IconButton
                        size="small"
                        aria-label="Modifier"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(c)
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      {c.active && (
                        <IconButton
                          size="small"
                          color="error"
                          aria-label="Désactiver"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(c)
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
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

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Modifier le client' : 'Nouveau client'}
      >
        <Stack component="form" spacing={2} onSubmit={onSubmit} sx={{ mt: 1 }}>
          <TextField label="Nom / Raison sociale" value={form.name} onChange={set('name')} required autoFocus />
          <TextField
            select
            label="Type"
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as ClientKind }))}
          >
            <MenuItem value="PRO">Professionnel</MenuItem>
            <MenuItem value="PARTICULIER">Particulier</MenuItem>
          </TextField>
          {form.kind === 'PRO' && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="SIRET" value={form.siret} onChange={set('siret')} fullWidth />
              <TextField label="TVA intra." value={form.tvaIntra} onChange={set('tvaIntra')} fullWidth />
            </Stack>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Email" type="email" value={form.email} onChange={set('email')} fullWidth />
            <TextField label="Téléphone" value={form.phone} onChange={set('phone')} fullWidth />
          </Stack>
          <TextField label="Adresse" value={form.address} onChange={set('address')} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Code postal" value={form.postalCode} onChange={set('postalCode')} sx={{ maxWidth: { xs: '100%', sm: 160 } }} />
            <TextField label="Ville" value={form.city} onChange={set('city')} fullWidth />
          </Stack>
          <TextField label="Pays" value={form.country} onChange={set('country')} />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}
          </Button>
        </Stack>
      </Modal>
    </>
  )
}
