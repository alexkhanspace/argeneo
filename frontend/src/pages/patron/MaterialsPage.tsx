import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import FolderIcon from '@mui/icons-material/Folder'
import { errorMessage } from '../../api/client'
import {
  createRawMaterial,
  deleteRawMaterial,
  listFamilles,
  listRawMaterials,
  listUnits,
  updateRawMaterial,
} from '../../api/costing'
import type { Famille, MeasureUnit, RawMaterial, UnitInfo } from '../../api/types'
import { FamilleManager } from '../../components/FamilleManager'
import { FamilleSelect } from '../../components/FamilleSelect'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'

/** Carte d'une matière en vue mobile : nom, famille, prix éditable, édition complète et suppression. */
function MobileMaterialCard({
  material,
  onSaved,
  onEdit,
  onDelete,
  onError,
}: {
  material: RawMaterial
  onSaved: (m: RawMaterial) => void
  onEdit: (m: RawMaterial) => void
  onDelete: (m: RawMaterial) => void
  onError: (msg: string) => void
}) {
  const [price, setPrice] = useState(String(material.pricePerUnit))
  const [busy, setBusy] = useState(false)
  const changed = Number(price) !== Number(material.pricePerUnit)

  const save = async () => {
    setBusy(true)
    try {
      await updateRawMaterial(material.id, {
        name: material.name,
        pricePerUnit: Number(price),
        familleId: material.familleId,
        sousFamilleId: material.sousFamilleId,
      })
      onSaved({ ...material, pricePerUnit: Number(price) })
    } catch (err) {
      onError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }}>{material.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              Unité : {material.referenceUnit}
            </Typography>
            {material.familleName && (
              <Stack direction="row" sx={{ gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                <Chip label={material.familleName} size="small" variant="outlined" />
                {material.sousFamilleName && (
                  <Chip label={material.sousFamilleName} size="small" variant="outlined" />
                )}
              </Stack>
            )}
          </Box>
          <Stack direction="row">
            <IconButton size="small" aria-label="Modifier" onClick={() => onEdit(material)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" aria-label="Supprimer" onClick={() => onDelete(material)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mt: 1 }}>
          <TextField
            type="number"
            size="small"
            label={`Prix net (€ / ${material.referenceUnit})`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            slotProps={{ htmlInput: { step: '0.0001', min: '0' } }}
            sx={{ flex: 1 }}
          />
          <Button size="small" variant="contained" disabled={busy || !changed} onClick={save}>
            OK
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}

export function MaterialsPage() {
  const [items, setItems] = useState<RawMaterial[]>([])
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [familles, setFamilles] = useState<Famille[]>([])
  const [listError, setListError] = useState<string | null>(null)

  // Mobile : liste de cartes au lieu du tableau, avec tri dédié.
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [mobileSort, setMobileSort] = useState<'name' | 'price'>('name')

  // Filtres par famille / sous-famille (côté client).
  const [filterFamille, setFilterFamille] = useState<number | ''>('')
  const [filterSousFamille, setFilterSousFamille] = useState<number | ''>('')
  const [managerOpen, setManagerOpen] = useState(false)

  // Sélection multiple (tableau desktop) pour suppression groupée.
  const [selection, setSelection] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() })

  // Création
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [referenceUnit, setReferenceUnit] = useState<MeasureUnit>('KG')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [cFamilleId, setCFamilleId] = useState<number | null>(null)
  const [cSousFamilleId, setCSousFamilleId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Édition (nom, prix, famille)
  const [editItem, setEditItem] = useState<RawMaterial | null>(null)
  const [eName, setEName] = useState('')
  const [ePrice, setEPrice] = useState('')
  const [eFamilleId, setEFamilleId] = useState<number | null>(null)
  const [eSousFamilleId, setESousFamilleId] = useState<number | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editBusy, setEditBusy] = useState(false)

  const refresh = () => {
    listRawMaterials().then(setItems).catch((e) => setListError(errorMessage(e)))
  }
  const refreshFamilles = () => {
    listFamilles('RAW_MATERIAL').then(setFamilles).catch(() => undefined)
  }
  useEffect(() => {
    refresh()
    refreshFamilles()
    listUnits().then(setUnits).catch(() => undefined)
  }, [])

  const filterSousFamilles = familles.find((f) => f.id === filterFamille)?.children ?? []

  const filtered = useMemo(
    () =>
      items.filter((m) => {
        if (filterFamille !== '' && m.familleId !== filterFamille) return false
        if (filterSousFamille !== '' && m.sousFamilleId !== filterSousFamille) return false
        return true
      }),
    [items, filterFamille, filterSousFamille],
  )

  const onDelete = async (m: RawMaterial) => {
    if (!window.confirm(`Supprimer la matière « ${m.name} » ?`)) return
    try {
      await deleteRawMaterial(m.id)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  // Ids réellement sélectionnés (gère le mode « tout sauf » du DataGrid).
  const selectedIds = useMemo<number[]>(() => {
    if (selection.type === 'exclude') {
      return filtered.filter((m) => !selection.ids.has(m.id)).map((m) => m.id)
    }
    return Array.from(selection.ids) as number[]
  }, [selection, filtered])

  const onBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Supprimer ${selectedIds.length} matière(s) ?`)) return
    setListError(null)
    const results = await Promise.allSettled(selectedIds.map((id) => deleteRawMaterial(id)))
    const failed = results.filter((r) => r.status === 'rejected').length
    setSelection({ type: 'include', ids: new Set() })
    refresh()
    if (failed > 0) {
      setListError(`${failed} matière(s) non supprimée(s) : encore utilisée(s) dans une recette.`)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createRawMaterial({
        name,
        referenceUnit,
        pricePerUnit: Number(pricePerUnit),
        familleId: cFamilleId,
        sousFamilleId: cSousFamilleId,
      })
      setName('')
      setPricePerUnit('')
      setCFamilleId(null)
      setCSousFamilleId(null)
      setOpen(false)
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const openEdit = (m: RawMaterial) => {
    setEditItem(m)
    setEName(m.name)
    setEPrice(String(m.pricePerUnit))
    setEFamilleId(m.familleId)
    setESousFamilleId(m.sousFamilleId)
    setEditError(null)
  }

  const onEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editItem) return
    setEditError(null)
    setEditBusy(true)
    try {
      await updateRawMaterial(editItem.id, {
        name: eName,
        pricePerUnit: Number(ePrice),
        familleId: eFamilleId,
        sousFamilleId: eSousFamilleId,
      })
      setEditItem(null)
      refresh()
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setEditBusy(false)
    }
  }

  // Édition du prix directement dans la cellule (double-clic), enregistrée à la validation.
  const processRowUpdate = async (newRow: RawMaterial) => {
    const price = Number(newRow.pricePerUnit)
    await updateRawMaterial(newRow.id, {
      name: newRow.name,
      pricePerUnit: price,
      familleId: newRow.familleId,
      sousFamilleId: newRow.sousFamilleId,
    })
    const updated = { ...newRow, pricePerUnit: price }
    setItems((list) => list.map((m) => (m.id === updated.id ? updated : m)))
    return updated
  }

  const columns: GridColDef<RawMaterial>[] = [
    { field: 'name', headerName: 'Matière', flex: 1, minWidth: 160 },
    {
      field: 'familleName',
      headerName: 'Famille',
      width: 150,
      valueGetter: (v) => (v as string | null) ?? '—',
    },
    {
      field: 'sousFamilleName',
      headerName: 'Sous-famille',
      width: 150,
      valueGetter: (v) => (v as string | null) ?? '—',
    },
    { field: 'referenceUnit', headerName: 'Unité', width: 80 },
    {
      field: 'pricePerUnit',
      headerName: 'Prix net HT',
      description: 'Double-cliquez pour modifier le prix',
      width: 170,
      type: 'number',
      editable: true,
      valueFormatter: (v, row) =>
        v == null
          ? '—'
          : `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} € / ${row.referenceUnit}`,
    },
    {
      field: 'actions',
      headerName: '',
      width: 96,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (p) => (
        <>
          <Tooltip title="Modifier">
            <IconButton size="small" onClick={() => openEdit(p.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Supprimer">
            <IconButton size="small" color="error" onClick={() => onDelete(p.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Matières premières"
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<FolderIcon />} onClick={() => setManagerOpen(true)}>
              Familles
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
              Nouvelle matière
            </Button>
          </Stack>
        }
      />

      {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* Barre de filtres famille / sous-famille (réduit la liste, donc le scroll). */}
          {familles.length > 0 && (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ mb: 2, maxWidth: { sm: 520 } }}
            >
              <TextField
                select
                size="small"
                label="Famille"
                value={filterFamille === '' ? '' : String(filterFamille)}
                onChange={(e) => {
                  setFilterFamille(e.target.value === '' ? '' : Number(e.target.value))
                  setFilterSousFamille('')
                }}
                sx={{ flex: 1 }}
              >
                <MenuItem value="">Toutes</MenuItem>
                {familles.map((f) => (
                  <MenuItem key={f.id} value={String(f.id)}>
                    {f.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Sous-famille"
                value={filterSousFamille === '' ? '' : String(filterSousFamille)}
                onChange={(e) => setFilterSousFamille(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={filterFamille === '' || filterSousFamilles.length === 0}
                sx={{ flex: 1 }}
              >
                <MenuItem value="">Toutes</MenuItem>
                {filterSousFamilles.map((sf) => (
                  <MenuItem key={sf.id} value={String(sf.id)}>
                    {sf.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          )}

          {items.length === 0 ? (
            <Typography color="text.secondary">Aucune matière. Cliquez sur « + Nouvelle matière ».</Typography>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              <TextField
                select
                size="small"
                label="Trier par"
                value={mobileSort}
                onChange={(e) => setMobileSort(e.target.value as 'name' | 'price')}
                sx={{ maxWidth: 200 }}
              >
                <MenuItem value="name">Nom</MenuItem>
                <MenuItem value="price">Prix</MenuItem>
              </TextField>
              {[...filtered]
                .sort((a, b) =>
                  mobileSort === 'price'
                    ? b.pricePerUnit - a.pricePerUnit
                    : a.name.localeCompare(b.name),
                )
                .map((m) => (
                  <MobileMaterialCard
                    key={m.id}
                    material={m}
                    onSaved={(u) => setItems((list) => list.map((x) => (x.id === u.id ? u : x)))}
                    onEdit={openEdit}
                    onDelete={onDelete}
                    onError={setListError}
                  />
                ))}
            </Stack>
          ) : (
            <Box>
              {selectedIds.length > 0 && (
                <Stack direction="row" sx={{ mb: 1, justifyContent: 'flex-end' }}>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteIcon />}
                    onClick={() => void onBulkDelete()}
                  >
                    Supprimer la sélection ({selectedIds.length})
                  </Button>
                </Stack>
              )}
              <Box sx={{ height: 560, width: '100%' }}>
                <DataGrid
                  rows={filtered}
                  columns={columns}
                  showToolbar
                  checkboxSelection
                  disableRowSelectionOnClick
                  rowSelectionModel={selection}
                  onRowSelectionModelChange={(model) => setSelection(model)}
                  sortingOrder={['asc', 'desc', null]}
                  processRowUpdate={processRowUpdate}
                  onProcessRowUpdateError={(e) => setListError(errorMessage(e))}
                  pageSizeOptions={[25, 50, 100]}
                  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                  sx={{ border: 0 }}
                />
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle matière première">
        <Stack component="form" spacing={2} onSubmit={onSubmit} sx={{ mt: 1 }}>
          <TextField
            label="Nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <TextField
            select
            label="Unité de référence"
            value={referenceUnit}
            onChange={(e) => setReferenceUnit(e.target.value as MeasureUnit)}
          >
            {units.map((u) => (
              <MenuItem key={u.code} value={u.code}>
                {u.code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={`Prix net HT (€ / ${referenceUnit})`}
            type="number"
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(e.target.value)}
            slotProps={{ htmlInput: { step: '0.0001', min: '0' } }}
            required
          />
          {familles.length > 0 && (
            <FamilleSelect
              familles={familles}
              familleId={cFamilleId}
              sousFamilleId={cSousFamilleId}
              onChange={(f, sf) => {
                setCFamilleId(f)
                setCSousFamilleId(sf)
              }}
            />
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Ajout…' : 'Ajouter'}
          </Button>
        </Stack>
      </Modal>

      <Modal open={editItem !== null} onClose={() => setEditItem(null)} title="Modifier la matière">
        {editItem && (
          <Stack component="form" spacing={2} onSubmit={onEditSubmit} sx={{ mt: 1 }}>
            <TextField label="Nom" value={eName} onChange={(e) => setEName(e.target.value)} required autoFocus />
            <TextField
              label={`Prix net HT (€ / ${editItem.referenceUnit})`}
              type="number"
              value={ePrice}
              onChange={(e) => setEPrice(e.target.value)}
              slotProps={{ htmlInput: { step: '0.0001', min: '0' } }}
              required
            />
            {familles.length > 0 && (
              <FamilleSelect
                familles={familles}
                familleId={eFamilleId}
                sousFamilleId={eSousFamilleId}
                onChange={(f, sf) => {
                  setEFamilleId(f)
                  setESousFamilleId(sf)
                }}
              />
            )}
            {editError && <Alert severity="error">{editError}</Alert>}
            <Button type="submit" variant="contained" disabled={editBusy}>
              {editBusy ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </Stack>
        )}
      </Modal>

      <FamilleManager
        open={managerOpen}
        scope="RAW_MATERIAL"
        onClose={() => setManagerOpen(false)}
        onChanged={() => {
          refreshFamilles()
          refresh()
        }}
      />
    </>
  )
}
