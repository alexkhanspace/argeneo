import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import CalculateIcon from '@mui/icons-material/Calculate'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CampaignIcon from '@mui/icons-material/Campaign'
import FolderIcon from '@mui/icons-material/Folder'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { errorMessage } from '../../api/client'
import {
  createArticle,
  deleteArticle,
  generateArticlePhoto,
  getCost,
  listArticles,
  listFamilles,
  listUnits,
  photoUrl,
  updateArticle,
  uploadArticlePhoto,
} from '../../api/costing'
import { listLabelTemplates, type LabelTemplate } from '../../api/labels'
import type { Article, ArticleType, Famille, MeasureUnit, UnitInfo } from '../../api/types'
import { FamilleManager } from '../../components/FamilleManager'
import { FamilleSelect } from '../../components/FamilleSelect'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { PriceCalculator } from '../../components/PriceCalculator'
import { ProductSheet } from '../../components/ProductSheet'

const typeLabel = (t: ArticleType): string =>
  t === 'FABRIQUE' ? 'Fabriqué' : t === 'MENU' ? 'Menu' : 'Acheté'

/**
 * Champ « Nom » : Entrée valide le formulaire (comme un champ simple), Shift+Entrée
 * insère un saut de ligne — repris tel quel sur l'étiquette du produit.
 */
function nameKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    ;((e.target as HTMLElement).closest('form') as HTMLFormElement | null)?.requestSubmit()
  }
}

function formatEur(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })
}

type CostInfo = { unitCost: number; coefficient: number | null } | 'error' | undefined

/** Ligne du tableau : article enrichi du coût (chargé en asynchrone) pour le tri/filtre. */
type ArticleRow = Article & {
  unitCost: number | null
  coefficient: number | null
  costState: 'loading' | 'ok' | 'error'
}

const VAT_OPTIONS = [
  { value: '0.055', label: '5,5 % (à emporter)' },
  { value: '0.10', label: '10 % (sur place)' },
  { value: '0.20', label: '20 % (alcool/divers)' },
]

const FALLBACK_UNITS: MeasureUnit[] = ['G', 'KG', 'ML', 'L', 'PIECE']

export function ArticlesPage() {
  const [items, setItems] = useState<Article[]>([])
  const [costs, setCosts] = useState<Record<number, CostInfo>>({})
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [familles, setFamilles] = useState<Famille[]>([])
  const [labelTemplates, setLabelTemplates] = useState<LabelTemplate[]>([])
  const [listError, setListError] = useState<string | null>(null)

  // Mobile : liste de cartes (fiches) au lieu du tableau, avec un tri dédié.
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [mobileSort, setMobileSort] = useState<'name' | 'coef' | 'pv'>('name')

  // Filtres par famille / sous-famille (côté client) + gestion du référentiel.
  const [filterFamille, setFilterFamille] = useState<number | ''>('')
  const [filterSousFamille, setFilterSousFamille] = useState<number | ''>('')
  const [managerOpen, setManagerOpen] = useState(false)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<ArticleType>('FABRIQUE')
  const [unit, setUnit] = useState<MeasureUnit>('PIECE')
  const [salePrice, setSalePrice] = useState('')
  const [vatRate, setVatRate] = useState('0.055')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [description, setDescription] = useState('')
  const [cFamilleId, setCFamilleId] = useState<number | null>(null)
  const [cSousFamilleId, setCSousFamilleId] = useState<number | null>(null)
  const [cLabelTemplateId, setCLabelTemplateId] = useState<number | null>(null)
  // Photo prise/importée à la création : conservée puis uploadée dès que l'article a un id.
  const [cPhotoFile, setCPhotoFile] = useState<File | null>(null)
  const [cPhotoPreview, setCPhotoPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Édition
  const [editArticle, setEditArticle] = useState<Article | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<ArticleType>('FABRIQUE')
  const [editUnit, setEditUnit] = useState<MeasureUnit>('PIECE')
  const [editSalePrice, setEditSalePrice] = useState('')
  const [editVatRate, setEditVatRate] = useState('0.055')
  const [editPurchasePrice, setEditPurchasePrice] = useState('')
  const [editGtin, setEditGtin] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editFamilleId, setEditFamilleId] = useState<number | null>(null)
  const [editSousFamilleId, setEditSousFamilleId] = useState<number | null>(null)
  const [editLabelTemplateId, setEditLabelTemplateId] = useState<number | null>(null)
  const [editPhotoFile, setEditPhotoFile] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  const [genBusy, setGenBusy] = useState(false)
  // Fiche produit (lecture seule) au clic ; le formulaire d'édition est séparé.
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const navigate = useNavigate()

  const refresh = () => {
    listArticles()
      .then((list) => {
        setItems(list)
        list.forEach((a) => {
          getCost(a.id)
            .then((p) => setCosts((c) => ({ ...c, [a.id]: { unitCost: p.unitCost, coefficient: p.coefficient ?? null } })))
            .catch(() => setCosts((c) => ({ ...c, [a.id]: 'error' })))
        })
      })
      .catch((e) => setListError(errorMessage(e)))
  }
  const refreshFamilles = () => {
    listFamilles('ARTICLE').then(setFamilles).catch(() => undefined)
  }
  useEffect(() => {
    refresh()
    refreshFamilles()
    listUnits().then(setUnits).catch(() => undefined)
    listLabelTemplates().then(setLabelTemplates).catch(() => undefined)
  }, [])

  const filterSousFamilles = familles.find((f) => f.id === filterFamille)?.children ?? []

  const onDelete = async (a: Article) => {
    if (!window.confirm(`Supprimer l'article « ${a.name} » (${a.code}) ?`)) return
    try {
      await deleteArticle(a.id)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  // Enregistre la photo prise/importée pour l'article en cours de création (aperçu local).
  const onCreatePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier
    if (!file) return
    setCPhotoFile(file)
    setCPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const clearCreatePhoto = () => {
    setCPhotoFile(null)
    setCPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const created = await createArticle({
        name,
        type,
        unit,
        salePriceTtc: salePrice ? Number(salePrice) : null,
        vatRate: vatRate ? Number(vatRate) : null,
        purchasePrice: type === 'ACHAT_REVENTE' && purchasePrice ? Number(purchasePrice) : null,
        description: description.trim() || null,
        familleId: cFamilleId,
        sousFamilleId: cSousFamilleId,
        labelTemplateId: cLabelTemplateId,
      })
      // La photo ne peut s'attacher qu'à un article existant : on l'envoie après création.
      if (cPhotoFile) {
        try {
          await uploadArticlePhoto(created.id, cPhotoFile)
        } catch {
          // Article créé quand même : la photo pourra être ré-ajoutée depuis l'édition.
        }
      }
      setName('')
      setSalePrice('')
      setPurchasePrice('')
      setDescription('')
      setCFamilleId(null)
      setCSousFamilleId(null)
      setCLabelTemplateId(null)
      clearCreatePhoto()
      setOpen(false)
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onEdit = (a: Article) => {
    setEditArticle(a)
    setEditName(a.name)
    setEditType(a.type)
    setEditUnit(a.unit)
    setEditSalePrice(a.salePriceTtc != null ? String(a.salePriceTtc) : '')
    setEditVatRate(a.vatRate != null ? String(a.vatRate) : '0.055')
    setEditPurchasePrice(a.purchasePrice != null ? String(a.purchasePrice) : '')
    setEditGtin(a.gtin ?? '')
    setEditDescription(a.description ?? '')
    setEditFamilleId(a.familleId)
    setEditSousFamilleId(a.sousFamilleId)
    setEditLabelTemplateId(a.labelTemplateId)
    setEditPhotoFile(a.photoFile)
    setEditError(null)
  }

  /** Ouvre la fiche produit (lecture seule) en chargeant l'article sélectionné. */
  const openSheet = (a: Article) => {
    onEdit(a)
    setSheetOpen(true)
  }
  /** Depuis la fiche : ouvre le formulaire d'édition (les champs sont déjà chargés). */
  const openEditForm = () => {
    setSheetOpen(false)
    setEditOpen(true)
  }

  const onPhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier
    if (!file || !editArticle) return
    setEditError(null)
    setEditBusy(true)
    try {
      const updated = await uploadArticlePhoto(editArticle.id, file)
      setEditPhotoFile(updated.photoFile)
      setEditArticle(updated)
      refresh()
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setEditBusy(false)
    }
  }

  const onGeneratePhoto = async () => {
    if (!editArticle) return
    setEditError(null)
    setGenBusy(true)
    try {
      const updated = await generateArticlePhoto(editArticle.id)
      setEditPhotoFile(updated.photoFile)
      setEditArticle(updated)
      refresh()
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setGenBusy(false)
    }
  }

  const onEditSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editArticle) return
    setEditError(null)
    setEditBusy(true)
    try {
      await updateArticle(editArticle.id, {
        name: editName,
        type: editType,
        unit: editUnit,
        salePriceTtc: editSalePrice ? Number(editSalePrice) : null,
        vatRate: editVatRate ? Number(editVatRate) : null,
        purchasePrice:
          editType === 'ACHAT_REVENTE' && editPurchasePrice ? Number(editPurchasePrice) : null,
        gtin: editGtin.trim() || null,
        description: editDescription.trim() || null,
        familleId: editFamilleId,
        sousFamilleId: editSousFamilleId,
        labelTemplateId: editLabelTemplateId,
      })
      setEditArticle(null)
      refresh()
    } catch (err) {
      setEditError(errorMessage(err))
    } finally {
      setEditBusy(false)
    }
  }

  // Fusion article + coût (le coût arrive en asynchrone via la map `costs`).
  const rows: ArticleRow[] = items.map((a) => {
    const c = costs[a.id]
    return {
      ...a,
      unitCost: c && c !== 'error' ? c.unitCost : null,
      coefficient: c && c !== 'error' ? c.coefficient : null,
      costState: c === undefined ? 'loading' : c === 'error' ? 'error' : 'ok',
    }
  })

  // Filtre famille / sous-famille (côté client) appliqué aux deux vues.
  const filteredRows = useMemo(
    () =>
      rows.filter((a) => {
        if (filterFamille !== '' && a.familleId !== filterFamille) return false
        if (filterSousFamille !== '' && a.sousFamilleId !== filterSousFamille) return false
        return true
      }),
    [rows, filterFamille, filterSousFamille],
  )

  // Tri pour la vue cartes mobile (le tableau desktop gère son tri lui-même).
  const sortedMobileRows = [...filteredRows].sort((a, b) => {
    if (mobileSort === 'coef') return (b.coefficient ?? -Infinity) - (a.coefficient ?? -Infinity)
    if (mobileSort === 'pv') return (b.salePriceTtc ?? -Infinity) - (a.salePriceTtc ?? -Infinity)
    return a.name.localeCompare(b.name)
  })

  const columns: GridColDef<ArticleRow>[] = [
    {
      field: 'photoFile',
      headerName: '',
      width: 64,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (p) =>
        p.row.photoFile ? (
          <Avatar
            variant="rounded"
            src={photoUrl(p.row.photoFile) ?? undefined}
            alt={p.row.name}
            sx={{ width: 36, height: 36 }}
          />
        ) : null,
    },
    {
      field: 'code',
      headerName: 'Code',
      width: 90,
      renderCell: (p) => <code>{p.row.code}</code>,
    },
    { field: 'name', headerName: 'Article', flex: 1, minWidth: 160 },
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      type: 'singleSelect',
      valueOptions: ['Fabriqué', 'Acheté', 'Menu'],
      valueGetter: (_v, row) => typeLabel(row.type),
      renderCell: (p) => <Chip label={p.value as string} size="small" variant="outlined" />,
    },
    {
      field: 'familleName',
      headerName: 'Famille',
      width: 140,
      valueGetter: (v) => (v as string | null) ?? '—',
    },
    {
      field: 'sousFamilleName',
      headerName: 'Sous-famille',
      width: 140,
      valueGetter: (v) => (v as string | null) ?? '—',
    },
    {
      field: 'salePriceTtc',
      headerName: 'PV TTC',
      width: 110,
      type: 'number',
      valueFormatter: (v) => formatEur(v as number | null),
    },
    {
      field: 'unitCost',
      headerName: 'PNET HT',
      width: 110,
      type: 'number',
      renderCell: (p) =>
        p.row.costState === 'loading' ? '…' : p.row.costState === 'error' ? '⚠︎' : formatEur(p.row.unitCost),
    },
    {
      field: 'coefficient',
      headerName: 'Coef',
      description: 'Coefficient de marge (PV TTC ÷ coût HT)',
      width: 90,
      type: 'number',
      renderCell: (p) => (p.row.coefficient != null ? `×${p.row.coefficient.toFixed(2)}` : '—'),
    },
  ]

  return (
    <>
      <PageHeader
        title="Articles"
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<FolderIcon />} onClick={() => setManagerOpen(true)}>
              Familles
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
              Nouvel article
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
            <Typography color="text.secondary">Aucun article. Cliquez sur « Nouvel article ».</Typography>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              <TextField
                select
                size="small"
                label="Trier par"
                value={mobileSort}
                onChange={(e) => setMobileSort(e.target.value as 'name' | 'coef' | 'pv')}
                sx={{ maxWidth: 200 }}
              >
                <MenuItem value="name">Nom</MenuItem>
                <MenuItem value="coef">Marge (coef)</MenuItem>
                <MenuItem value="pv">Prix de vente</MenuItem>
              </TextField>
              {sortedMobileRows.map((a) => (
                <Card
                  key={a.id}
                  variant="outlined"
                  onClick={() => openSheet(a)}
                  sx={{ cursor: 'pointer' }}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                      {a.photoFile && (
                        <Avatar
                          variant="rounded"
                          src={photoUrl(a.photoFile) ?? undefined}
                          alt={a.name}
                          sx={{ width: 48, height: 48, flexShrink: 0 }}
                        />
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Box component="code" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            {a.code}
                          </Box>
                          <Chip
                            label={typeLabel(a.type)}
                            size="small"
                            variant="outlined"
                          />
                        </Stack>
                        <Typography sx={{ fontWeight: 600 }}>{a.name}</Typography>
                        <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            PV {formatEur(a.salePriceTtc)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            PNET{' '}
                            {a.costState === 'loading'
                              ? '…'
                              : a.costState === 'error'
                                ? '⚠︎'
                                : formatEur(a.unitCost)}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {a.coefficient != null ? `×${a.coefficient.toFixed(2)}` : '—'}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={filteredRows}
                columns={columns}
                showToolbar
                disableRowSelectionOnClick
                onRowClick={(params) => openSheet(params.row)}
                sortingOrder={['asc', 'desc', null]}
                pageSizeOptions={[25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                sx={{ border: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvel article">
        <form onSubmit={onSubmit}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              multiline
              maxRows={3}
              onKeyDown={nameKeyDown}
              helperText="Shift+Entrée : saut de ligne (repris sur l'étiquette)"
            />
            <TextField
              label="Description (aide l'IA : photo & prix)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={2}
              placeholder="Ex. bagel garni et refermé, saumon fumé, cream cheese, aneth…"
            />
            {/* Photo du produit : prise directement (caméra) ou importée dès la création. */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: 2,
              }}
            >
              <Avatar
                variant="rounded"
                src={cPhotoPreview ?? undefined}
                alt={name}
                sx={{ width: 72, height: 72, bgcolor: 'action.hover', color: 'text.disabled' }}
              >
                ?
              </Avatar>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="outlined" component="label" startIcon={<PhotoCameraIcon />}>
                  Prendre une photo
                  <input type="file" accept="image/*" capture="environment" hidden onChange={onCreatePhotoChange} />
                </Button>
                <Button variant="outlined" component="label">
                  {cPhotoFile ? 'Changer' : 'Importer'}
                  <input type="file" accept="image/*" hidden onChange={onCreatePhotoChange} />
                </Button>
                {cPhotoFile && (
                  <Button color="inherit" onClick={clearCreatePhoto}>
                    Retirer
                  </Button>
                )}
              </Stack>
            </Box>
            <TextField
              select
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as ArticleType)}
            >
              <MenuItem value="FABRIQUE">Fabriqué (recette) — code R</MenuItem>
              <MenuItem value="ACHAT_REVENTE">Acheté-revendu — code A</MenuItem>
              <MenuItem value="MENU">Menu / formule — code M</MenuItem>
            </TextField>
            <TextField
              select
              label="Unité"
              value={unit}
              onChange={(e) => setUnit(e.target.value as MeasureUnit)}
            >
              {units.map((u) => (
                <MenuItem key={u.code} value={u.code}>
                  {u.code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Prix de vente TTC (€)"
              type="number"
              slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
            <TextField
              select
              label="TVA"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
            >
              {VAT_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            {type === 'ACHAT_REVENTE' && (
              <TextField
                label="Prix d'achat HT (€ = PNET)"
                type="number"
                slotProps={{ htmlInput: { step: '0.0001', min: '0' } }}
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
              />
            )}
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
            {labelTemplates.length > 0 && (
              <TextField
                select
                label="Modèle d'étiquette (optionnel)"
                value={cLabelTemplateId == null ? '' : String(cLabelTemplateId)}
                onChange={(e) => setCLabelTemplateId(e.target.value === '' ? null : Number(e.target.value))}
                helperText="Le modèle règle l'étiquette (style + badges) à l'impression."
              >
                <MenuItem value="">
                  <em>— Aucun</em>
                </MenuItem>
                {labelTemplates.map((t) => (
                  <MenuItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? 'Création…' : 'Créer l\'article'}
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        open={editOpen && editArticle !== null}
        onClose={() => setEditOpen(false)}
        title="Modifier l'article"
      >
        {editArticle && (
          <form onSubmit={onEditSubmit}>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Code" value={editArticle.code} disabled />
              <TextField
                select
                label="Type"
                value={editType}
                onChange={(e) => setEditType(e.target.value as ArticleType)}
                helperText="Le code reste inchangé même si tu changes le type."
              >
                <MenuItem value="FABRIQUE">Fabriqué (recette)</MenuItem>
                <MenuItem value="ACHAT_REVENTE">Acheté-revendu</MenuItem>
                <MenuItem value="MENU">Menu / formule</MenuItem>
              </TextField>
              <TextField
                label="Nom"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                autoFocus
                multiline
                maxRows={3}
                onKeyDown={nameKeyDown}
                helperText="Shift+Entrée : saut de ligne (repris sur l'étiquette)"
              />
              <TextField
                label="Description (aide l'IA : photo & prix)"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                multiline
                minRows={2}
                placeholder="Ex. bagel garni et refermé, saumon fumé, cream cheese, aneth…"
              />
              <TextField
                select
                label="Unité"
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value as MeasureUnit)}
              >
                {(units.length > 0 ? units.map((u) => u.code) : FALLBACK_UNITS).map((code) => (
                  <MenuItem key={code} value={code}>
                    {code}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="GTIN (code-barres, optionnel)"
                value={editGtin}
                onChange={(e) => setEditGtin(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 14, inputMode: 'numeric' } }}
              />
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 2,
                }}
              >
                <Avatar
                  variant="rounded"
                  src={photoUrl(editPhotoFile) ?? undefined}
                  alt={editName}
                  sx={{ width: 72, height: 72 }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<PhotoCameraIcon />}
                    disabled={editBusy || genBusy}
                  >
                    Prendre une photo
                    <input type="file" accept="image/*" capture="environment" hidden onChange={onPhotoChange} />
                  </Button>
                  <Button variant="outlined" component="label" disabled={editBusy || genBusy}>
                    {editPhotoFile ? 'Changer la photo' : 'Importer'}
                    <input type="file" accept="image/*" hidden onChange={onPhotoChange} />
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={genBusy ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                    onClick={onGeneratePhoto}
                    disabled={editBusy || genBusy}
                  >
                    {genBusy ? 'Génération…' : 'Générer par IA'}
                  </Button>
                </Stack>
              </Box>
              <TextField
                label="Prix de vente TTC (€)"
                type="number"
                slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
                value={editSalePrice}
                onChange={(e) => setEditSalePrice(e.target.value)}
              />
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CalculateIcon />}
                  onClick={() => setCalcOpen(true)}
                >
                  Calculateur de prix
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CampaignIcon />}
                  onClick={() => editArticle && navigate(`/communication?article=${editArticle.id}`)}
                >
                  Communiquer
                </Button>
              </Stack>
              <TextField
                select
                label="TVA"
                value={editVatRate}
                onChange={(e) => setEditVatRate(e.target.value)}
              >
                {VAT_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              {editType === 'ACHAT_REVENTE' && (
                <TextField
                  label="Prix d'achat HT (€ = PNET)"
                  type="number"
                  slotProps={{ htmlInput: { step: '0.0001', min: '0' } }}
                  value={editPurchasePrice}
                  onChange={(e) => setEditPurchasePrice(e.target.value)}
                />
              )}
              {familles.length > 0 && (
                <FamilleSelect
                  familles={familles}
                  familleId={editFamilleId}
                  sousFamilleId={editSousFamilleId}
                  onChange={(f, sf) => {
                    setEditFamilleId(f)
                    setEditSousFamilleId(sf)
                  }}
                />
              )}
              <TextField
                select
                label="Modèle d'étiquette (optionnel)"
                value={editLabelTemplateId == null ? '' : String(editLabelTemplateId)}
                onChange={(e) => setEditLabelTemplateId(e.target.value === '' ? null : Number(e.target.value))}
                helperText={
                  labelTemplates.length === 0
                    ? 'Aucun modèle : crée-en dans « Modèles d’étiquette ».'
                    : "Règle l'étiquette (style + badges) à l'impression."
                }
              >
                <MenuItem value="">
                  <em>— Aucun</em>
                </MenuItem>
                {labelTemplates.map((t) => (
                  <MenuItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>
              {editError && <Alert severity="error">{editError}</Alert>}
              <Button type="submit" variant="contained" disabled={editBusy}>
                {editBusy ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </Stack>
          </form>
        )}
      </Modal>

      {editArticle && (
        <PriceCalculator
          open={calcOpen}
          onClose={() => setCalcOpen(false)}
          cost={
            costs[editArticle.id] && costs[editArticle.id] !== 'error'
              ? (costs[editArticle.id] as { unitCost: number }).unitCost
              : null
          }
          vatRate={editVatRate ? Number(editVatRate) : 0.055}
          articleName={editName || editArticle.name}
          articleType={editArticle.type === 'FABRIQUE' ? 'Fabriqué (recette)' : 'Acheté-revendu'}
          articleDescription={editDescription || editArticle.description}
          onApply={(ttc) => setEditSalePrice(String(ttc))}
        />
      )}

      {editArticle && (
        <ProductSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          article={editArticle}
          unitCost={
            costs[editArticle.id] && costs[editArticle.id] !== 'error'
              ? (costs[editArticle.id] as { unitCost: number }).unitCost
              : null
          }
          coefficient={
            costs[editArticle.id] && costs[editArticle.id] !== 'error'
              ? (costs[editArticle.id] as { coefficient: number | null }).coefficient
              : null
          }
          genBusy={genBusy}
          onEdit={openEditForm}
          onRecipe={() => navigate(`/articles/${editArticle.id}/recipe`)}
          onMenu={() => navigate(`/articles/${editArticle.id}/menu`)}
          onCalc={() => {
            setSheetOpen(false)
            setCalcOpen(true)
          }}
          onPub={() => {
            setSheetOpen(false)
            navigate(`/communication?article=${editArticle.id}`)
          }}
          onGeneratePhoto={() => void onGeneratePhoto()}
          onDelete={() => {
            setSheetOpen(false)
            void onDelete(editArticle)
          }}
        />
      )}

      <FamilleManager
        open={managerOpen}
        scope="ARTICLE"
        onClose={() => setManagerOpen(false)}
        onChanged={() => {
          refreshFamilles()
          refresh()
        }}
      />
    </>
  )
}
