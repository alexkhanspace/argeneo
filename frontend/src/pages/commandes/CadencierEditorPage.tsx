import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteIcon from '@mui/icons-material/Delete'
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { errorMessage } from '../../api/client'
import {
  createSheet,
  deleteSheet,
  getSheet,
  scanSheetPage,
  updateSheet,
  type SheetInput,
  type SheetLine,
} from '../../api/ordering'
import { PdfViewerModal } from '../../components/PdfViewerModal'
import { buildPurchaseOrderPdfBlob } from '../../pdf/buildPurchaseOrderPdf'
import { compressImage } from '../../utils/image'

/** Ligne en cours d'édition : clé locale stable + champs saisis en texte. */
interface EditLine {
  key: number
  id: number | null
  section: string
  code: string
  designation: string
  designationAlt: string
  packaging: string
  unitPrice: string
  priceUnit: string
  rawMaterialId: number | null
}

let nextKey = 1
const toEdit = (l: SheetLine): EditLine => ({
  key: nextKey++,
  id: l.id,
  section: l.section ?? '',
  code: l.code ?? '',
  designation: l.designation,
  designationAlt: l.designationAlt ?? '',
  packaging: l.packaging ?? '',
  unitPrice: l.unitPrice != null ? String(l.unitPrice) : '',
  priceUnit: l.priceUnit ?? '',
  rawMaterialId: l.rawMaterialId,
})
const emptyLine = (): EditLine => toEdit({
  id: null,
  section: null,
  code: null,
  designation: '',
  designationAlt: null,
  packaging: null,
  unitPrice: null,
  priceUnit: null,
  rawMaterialId: null,
})
const orNull = (s: string) => (s.trim() ? s.trim() : null)

/** Création / édition d'un cadencier, avec import IA d'un bon papier (plusieurs pages). */
export function CadencierEditorPage() {
  const { id } = useParams()
  const isNew = id === 'new' || id === undefined
  const sheetId = isNew ? null : Number(id)
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [loaded, setLoaded] = useState(isNew)
  const [name, setName] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [supplierEmail, setSupplierEmail] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState('#1f4e79')
  const [showPrices, setShowPrices] = useState(true)
  const [active, setActive] = useState(true)
  const [lines, setLines] = useState<EditLine[]>([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null)
  const [scanInfo, setScanInfo] = useState<string | null>(null)
  const [pdf, setPdf] = useState<Blob | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (sheetId == null) return
    getSheet(sheetId)
      .then((s) => {
        setName(s.name)
        setSupplierName(s.supplierName ?? '')
        setSupplierEmail(s.supplierEmail ?? '')
        setSupplierPhone(s.supplierPhone ?? '')
        setNotes(s.notes ?? '')
        setColor(s.color ?? '#1f4e79')
        setShowPrices(s.showPrices)
        setActive(s.active)
        setLines(s.lines.map(toEdit))
        setLoaded(true)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [sheetId])

  // Arrivée depuis « Importer un cadencier papier » : ouvre directement le sélecteur de fichiers.
  useEffect(() => {
    if (isNew && params.get('import') === '1') fileInput.current?.click()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = (key: number, patch: Partial<EditLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const remove = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key))
  const move = (i: number, dir: -1 | 1) =>
    setLines((ls) => {
      const j = i + dir
      if (j < 0 || j >= ls.length) return ls
      const next = [...ls]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const insertAfter = (i: number) =>
    setLines((ls) => [...ls.slice(0, i + 1), { ...emptyLine(), section: ls[i]?.section ?? '' }, ...ls.slice(i + 1)])

  /** Lit chaque page (dans l'ordre choisi) et ajoute ses lignes à la suite. */
  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setError(null)
    setScanInfo(null)
    setScan({ done: 0, total: files.length })
    let added = 0
    const failed: string[] = []
    for (let i = 0; i < files.length; i++) {
      try {
        const res = await scanSheetPage(await compressImage(files[i]))
        if (res.name) setName((n) => n || res.name || '')
        if (res.supplierName) setSupplierName((n) => n || res.supplierName || '')
        setLines((ls) => [...ls, ...res.lines.map(toEdit)])
        added += res.lines.length
      } catch (err) {
        failed.push(`page ${i + 1} (${errorMessage(err)})`)
      }
      setScan({ done: i + 1, total: files.length })
    }
    setScan(null)
    setScanInfo(
      `${added} ligne(s) importée(s) depuis ${files.length - failed.length} page(s). Relisez puis enregistrez.` +
        (failed.length ? ` Échec : ${failed.join(', ')}.` : ''),
    )
  }

  const input = (): SheetInput => ({
    name: name.trim(),
    supplierName: orNull(supplierName),
    supplierEmail: orNull(supplierEmail),
    supplierPhone: orNull(supplierPhone),
    notes: orNull(notes),
    color,
    showPrices,
    active,
    lines: lines
      .filter((l) => l.designation.trim())
      .map((l) => ({
        id: l.id,
        section: orNull(l.section),
        code: orNull(l.code),
        designation: l.designation.trim(),
        designationAlt: orNull(l.designationAlt),
        packaging: orNull(l.packaging),
        unitPrice: l.unitPrice.trim() ? Number(l.unitPrice.replace(',', '.')) : null,
        priceUnit: orNull(l.priceUnit),
        rawMaterialId: l.rawMaterialId,
      })),
  })

  const onSave = async () => {
    if (!name.trim()) {
      setError('Donnez un nom au cadencier (ex. « BAKO », « Moulin Roos »).')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const res = sheetId == null ? await createSheet(input()) : await updateSheet(sheetId, input())
      setLines(res.lines.map(toEdit))
      setSaved(true)
      setScanInfo(null)
      if (sheetId == null) navigate(`/commandes/cadenciers/${res.id}`, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (sheetId == null || !window.confirm(`Supprimer le cadencier « ${name} » ? L'historique des commandes est conservé.`)) return
    try {
      await deleteSheet(sheetId)
      navigate('/commandes/cadenciers')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  /** Cadencier vierge à imprimer (colonne quantité vide). */
  const printBlank = async () => {
    setPdfBusy(true)
    try {
      const data = input()
      setPdf(
        await buildPurchaseOrderPdfBlob(
          {
            title: data.name || 'Cadencier',
            supplierName: data.supplierName,
            etablissementName: null,
            orderDate: null,
            deliveryDate: null,
            notes: null,
            createdByName: null,
            color,
            showPrices,
            lines: data.lines.map((l) => ({ ...l, quantity: null })),
          },
          'blank',
        ),
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPdfBusy(false)
    }
  }

  if (!loaded) {
    return <Typography color="text.secondary">{error ?? 'Chargement…'}</Typography>
  }

  const scanning = scan != null
  return (
    <>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button component={Link} to="/commandes/cadenciers" variant="outlined" size="small" startIcon={<ArrowBackIcon />}>
          Cadenciers
        </Button>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={pdfBusy ? <CircularProgress size={14} /> : <PictureAsPdfIcon />}
            onClick={() => void printBlank()}
            disabled={pdfBusy || lines.length === 0}
          >
            Imprimer vierge
          </Button>
          {sheetId != null && (
            <Button variant="outlined" size="small" color="error" startIcon={<DeleteIcon />} onClick={() => void onDelete()}>
              Supprimer
            </Button>
          )}
          <Button variant="contained" size="small" onClick={() => void onSave()} disabled={busy || scanning}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </Stack>
      </Stack>

      <Typography variant="h1" gutterBottom>
        {isNew ? 'Nouveau cadencier' : name || 'Cadencier'}
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
            <TextField label="Nom du cadencier" value={name} onChange={(e) => setName(e.target.value)} required />
            <TextField label="Fournisseur" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                label="Couleur du bon"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                sx={{ width: 120 }}
              />
              <FormControlLabel
                control={<Switch checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />}
                label="Afficher les prix"
              />
            </Stack>
            <TextField label="E-mail fournisseur" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} />
            <TextField label="Téléphone fournisseur" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
            <FormControlLabel
              control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
              label={active ? 'Actif (proposé à la commande)' : 'Archivé'}
            />
            <TextField
              label="Notes (jours de livraison, minimum de commande…)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={1}
              sx={{ gridColumn: { md: '1 / -1' } }}
            />
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1, alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h2">Produits ({lines.length})</Typography>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" component="label" startIcon={<PhotoCameraIcon />} disabled={scanning}>
                Photographier une page
                <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onImport(e)} />
              </Button>
              <Button variant="outlined" component="label" startIcon={<DocumentScannerIcon />} disabled={scanning}>
                Importer photos / PDF
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  hidden
                  onChange={(e) => void onImport(e)}
                />
              </Button>
            </Stack>
          </Stack>

          {scanning && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                Lecture de la page {Math.min(scan.done + 1, scan.total)} / {scan.total}… (quelques secondes par page)
              </Typography>
              <LinearProgress variant="determinate" value={(scan.done / scan.total) * 100} />
            </Box>
          )}
          {scanInfo && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setScanInfo(null)}>{scanInfo}</Alert>}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Plusieurs pages : sélectionnez-les toutes d'un coup (dans l'ordre), ou photographiez-les une par une —
            chaque page s'ajoute à la suite.
          </Typography>

          {lines.length === 0 && !scanning && (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              Aucun produit. Importez votre bon papier ou ajoutez les produits un par un.
            </Typography>
          )}

          <Stack spacing={1}>
            {lines.length > 0 && (
              <Box
                sx={{
                  display: { xs: 'none', md: 'grid' },
                  gridTemplateColumns: LINE_COLUMNS,
                  gap: 1,
                  px: 0.5,
                  color: 'text.secondary',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <span>Rubrique</span>
                <span>Code</span>
                <span>Désignation</span>
                <span>Désignation 2</span>
                <span>Conditionnement</span>
                <span>Prix (€)</span>
                <span>Prix par</span>
                <span />
              </Box>
            )}
            {lines.map((l, i) => (
              <Box
                key={l.key}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', md: LINE_COLUMNS },
                  gap: 1,
                  alignItems: 'center',
                  p: { xs: 1, md: 0.5 },
                  border: { xs: '1px solid', md: 'none' },
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <TextField size="small" placeholder="Rubrique" value={l.section} onChange={(e) => update(l.key, { section: e.target.value })} />
                <TextField size="small" placeholder="Code" value={l.code} onChange={(e) => update(l.key, { code: e.target.value })} />
                <TextField
                  size="small"
                  placeholder="Désignation *"
                  value={l.designation}
                  onChange={(e) => update(l.key, { designation: e.target.value })}
                  error={!l.designation.trim()}
                  sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
                />
                <TextField
                  size="small"
                  placeholder="Désignation 2"
                  value={l.designationAlt}
                  onChange={(e) => update(l.key, { designationAlt: e.target.value })}
                  sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}
                />
                <TextField size="small" placeholder="Conditionnement" value={l.packaging} onChange={(e) => update(l.key, { packaging: e.target.value })} />
                <TextField
                  size="small"
                  placeholder="Prix"
                  value={l.unitPrice}
                  onChange={(e) => update(l.key, { unitPrice: e.target.value })}
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                />
                <TextField size="small" placeholder="kg, colis…" value={l.priceUnit} onChange={(e) => update(l.key, { priceUnit: e.target.value })} />
                <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                  <Tooltip title="Monter">
                    <span>
                      <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Descendre">
                    <span>
                      <IconButton size="small" disabled={i === lines.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Insérer une ligne dessous">
                    <IconButton size="small" onClick={() => insertAfter(i)}>
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Supprimer">
                    <IconButton size="small" color="error" onClick={() => remove(l.key)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            ))}
          </Stack>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setLines((ls) => [...ls, { ...emptyLine(), section: ls[ls.length - 1]?.section ?? '' }])}
            sx={{ mt: 1.5 }}
          >
            Produit
          </Button>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {saved && !error && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>Cadencier enregistré.</Alert>}
      <Button variant="contained" onClick={() => void onSave()} disabled={busy || scanning} sx={{ width: { xs: '100%', sm: 'auto' } }}>
        {busy ? 'Enregistrement…' : 'Enregistrer le cadencier'}
      </Button>

      <PdfViewerModal
        open={pdf != null}
        onClose={() => setPdf(null)}
        blob={pdf}
        filename={`cadencier-${name || 'vierge'}.pdf`}
        title="Cadencier vierge"
      />
    </>
  )
}

const LINE_COLUMNS = '0.9fr 0.8fr 2fr 1.5fr 1fr 0.7fr 0.7fr auto'
