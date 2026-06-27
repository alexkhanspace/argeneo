import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner'
import DeleteIcon from '@mui/icons-material/Delete'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import ImageSearchIcon from '@mui/icons-material/ImageSearch'
import { errorMessage } from '../../api/client'
import { listFamilles, listRawMaterials } from '../../api/costing'
import {
  applyInvoice,
  deleteInvoice,
  getInvoice,
  getInvoiceFile,
  listInvoices,
  scanInvoice,
} from '../../api/invoices'
import type {
  Famille,
  InvoiceApplyAction,
  InvoiceApplyLine,
  InvoiceDetail,
  InvoiceLine,
  InvoiceSummary,
  MeasureUnit,
  RawMaterial,
} from '../../api/types'
import { FamilleSelect } from '../../components/FamilleSelect'
import { PageHeader } from '../../components/PageHeader'

const UNITS: MeasureUnit[] = ['G', 'KG', 'ML', 'L', 'PIECE']

const formatEur = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

const formatDate = (s: string | null): string =>
  s ? new Date(s).toLocaleDateString('fr-FR') : '—'

/** Décision de revue pour une ligne de facture. */
type LineDecision = {
  action: InvoiceApplyAction
  rawMaterialId: number | ''
  pricePerUnit: string
  newName: string
  newReferenceUnit: MeasureUnit
  familleId: number | null
  sousFamilleId: number | null
}

function initDecision(line: InvoiceLine): LineDecision {
  const price = line.suggestedPricePerUnit ?? line.unitPriceHt ?? ''
  if (line.applied) {
    return blankDecision('SKIP', line)
  }
  if (line.suggestedRawMaterialId != null) {
    return {
      action: 'UPDATE',
      rawMaterialId: line.suggestedRawMaterialId,
      pricePerUnit: String(price),
      newName: line.designation,
      newReferenceUnit: line.suggestedReferenceUnit ?? 'KG',
      familleId: null,
      sousFamilleId: null,
    }
  }
  return {
    action: 'CREATE',
    rawMaterialId: '',
    pricePerUnit: String(price),
    newName: line.designation,
    newReferenceUnit: line.suggestedReferenceUnit ?? 'KG',
    familleId: null,
    sousFamilleId: null,
  }
}

function blankDecision(action: InvoiceApplyAction, line: InvoiceLine): LineDecision {
  return {
    action,
    rawMaterialId: line.suggestedRawMaterialId ?? '',
    pricePerUnit: String(line.suggestedPricePerUnit ?? line.unitPriceHt ?? ''),
    newName: line.designation,
    newReferenceUnit: line.suggestedReferenceUnit ?? 'KG',
    familleId: null,
    sousFamilleId: null,
  }
}

export function InvoicesPage() {
  const [items, setItems] = useState<InvoiceSummary[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [familles, setFamilles] = useState<Famille[]>([])
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [review, setReview] = useState<InvoiceDetail | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const refresh = () => {
    listInvoices().then(setItems).catch((e) => setError(errorMessage(e)))
  }
  useEffect(() => {
    refresh()
    listRawMaterials().then(setMaterials).catch(() => undefined)
    listFamilles('RAW_MATERIAL').then(setFamilles).catch(() => undefined)
  }, [])

  // Fichier reçu via le partage système (Android) : le service worker l'a déposé, on le scanne.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('shared') !== '1') return
    void (async () => {
      try {
        const res = await fetch('/__shared-invoice')
        if (res.ok) {
          const blob = await res.blob()
          const nameHeader = res.headers.get('X-Filename')
          const name = nameHeader ? decodeURIComponent(nameHeader) : 'facture'
          const file = new File([blob], name, { type: blob.type || 'application/pdf' })
          setScanning(true)
          const detail = await scanInvoice(file)
          refresh()
          setReview(detail)
        }
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setScanning(false)
        window.history.replaceState({}, '', '/factures')
      }
    })()
  }, [])

  const onScan = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setScanning(true)
    try {
      const detail = await scanInvoice(file)
      refresh()
      setReview(detail) // ouvre directement la revue
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setScanning(false)
    }
  }

  const onDelete = async (inv: InvoiceSummary) => {
    if (!window.confirm(`Supprimer la facture ${inv.supplierName ?? ''} ${inv.invoiceNumber ?? ''} ?`)) return
    try {
      await deleteInvoice(inv.id)
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const openScan = async (id: number) => {
    try {
      const blob = await getInvoiceFile(id)
      window.open(URL.createObjectURL(blob), '_blank', 'noopener')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title="Factures fournisseurs"
        action={
          <Button
            variant="contained"
            startIcon={scanning ? <CircularProgress size={16} color="inherit" /> : <DocumentScannerIcon />}
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
          >
            {scanning ? 'Analyse IA…' : 'Scanner une facture'}
          </Button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          void onScan(f)
        }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <Typography color="text.secondary">
              Aucune facture. Cliquez sur « Scanner une facture » (photo ou PDF) : l'IA lit les lignes et
              propose la mise à jour des prix des matières premières.
            </Typography>
          ) : (
            <Stack divider={<Divider flexItem />} spacing={0}>
              {items.map((inv) => (
                <Stack
                  key={inv.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ py: 1.5, alignItems: { sm: 'center' } }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }} noWrap>
                      {inv.supplierName ?? 'Fournisseur inconnu'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(inv.invoiceDate)}
                      {inv.invoiceNumber ? ` · n° ${inv.invoiceNumber}` : ''} · {inv.lineCount} lignes
                    </Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 600, minWidth: 100 }}>
                    {formatEur(inv.totalTtc)}
                  </Typography>
                  <Chip
                    size="small"
                    label={
                      inv.status === 'TRAITEE'
                        ? `Traitée (${inv.appliedCount}/${inv.lineCount})`
                        : 'À traiter'
                    }
                    color={inv.status === 'TRAITEE' ? 'success' : 'warning'}
                    variant={inv.status === 'TRAITEE' ? 'filled' : 'outlined'}
                  />
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<FactCheckIcon />}
                      onClick={() => void getInvoiceAndReview(inv.id, setReview, setError)}
                    >
                      Revue
                    </Button>
                    {inv.hasScan && (
                      <Tooltip title="Voir le scan">
                        <IconButton size="small" onClick={() => void openScan(inv.id)}>
                          <ImageSearchIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Supprimer">
                      <IconButton size="small" color="error" onClick={() => void onDelete(inv)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {review && (
        <InvoiceReview
          key={review.id}
          detail={review}
          materials={materials}
          familles={familles}
          onClose={() => setReview(null)}
          onApplied={(updated) => {
            setReview(updated)
            refresh()
            listRawMaterials().then(setMaterials).catch(() => undefined)
          }}
          onFamillesChanged={setFamilles}
        />
      )}
    </>
  )
}

/** Charge le détail puis ouvre la revue (utilisé depuis la liste). */
async function getInvoiceAndReview(
  id: number,
  setReview: (d: InvoiceDetail) => void,
  setError: (m: string) => void,
) {
  try {
    setReview(await getInvoice(id))
  } catch (err) {
    setError(errorMessage(err))
  }
}

/** Dialog de revue : associer chaque ligne à une MP (ou en créer une) puis appliquer les prix. */
function InvoiceReview({
  detail,
  materials,
  familles,
  onClose,
  onApplied,
  onFamillesChanged,
}: {
  detail: InvoiceDetail
  materials: RawMaterial[]
  familles: Famille[]
  onClose: () => void
  onApplied: (updated: InvoiceDetail) => void
  onFamillesChanged: (familles: Famille[]) => void
}) {
  const [decisions, setDecisions] = useState<Record<number, LineDecision>>(() =>
    Object.fromEntries(detail.lines.map((l) => [l.id, initDecision(l)])),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const pendingCount = useMemo(
    () => detail.lines.filter((l) => !l.applied && decisions[l.id]?.action !== 'SKIP').length,
    [detail.lines, decisions],
  )

  const set = (lineId: number, patch: Partial<LineDecision>) =>
    setDecisions((d) => ({ ...d, [lineId]: { ...d[lineId], ...patch } }))

  const apply = async () => {
    setError(null)
    setDone(null)
    // Validation côté client
    const payload: InvoiceApplyLine[] = []
    for (const line of detail.lines) {
      if (line.applied) continue
      const dec = decisions[line.id]
      if (!dec || dec.action === 'SKIP') {
        payload.push({ lineId: line.id, action: 'SKIP' })
        continue
      }
      const price = Number(dec.pricePerUnit)
      if (!dec.pricePerUnit || Number.isNaN(price) || price < 0) {
        setError(`Ligne « ${line.designation} » : prix par unité invalide.`)
        return
      }
      if (dec.action === 'UPDATE') {
        if (dec.rawMaterialId === '') {
          setError(`Ligne « ${line.designation} » : choisissez une matière première.`)
          return
        }
        payload.push({
          lineId: line.id,
          action: 'UPDATE',
          rawMaterialId: Number(dec.rawMaterialId),
          pricePerUnit: price,
        })
      } else {
        if (!dec.newName.trim()) {
          setError(`Ligne « ${line.designation} » : nom de la matière requis.`)
          return
        }
        payload.push({
          lineId: line.id,
          action: 'CREATE',
          newName: dec.newName.trim(),
          newReferenceUnit: dec.newReferenceUnit,
          pricePerUnit: price,
          familleId: dec.familleId,
          sousFamilleId: dec.sousFamilleId,
        })
      }
    }
    setBusy(true)
    try {
      const updated = await applyInvoice(detail.id, payload)
      setDone('Prix appliqués aux matières premières.')
      onApplied(updated)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>
        Revue — {detail.supplierName ?? 'Fournisseur'} {detail.invoiceNumber ? `· ${detail.invoiceNumber}` : ''}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {formatDate(detail.invoiceDate)} · Total HT {formatEur(detail.totalHt)} · TTC {formatEur(detail.totalTtc)}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {detail.lines.length === 0 ? (
          <Alert severity="warning">
            Aucune ligne n'a pu être extraite. Vérifiez la lisibilité du scan, ou supprimez et réessayez.
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {detail.lines.map((line) => {
              const dec = decisions[line.id]
              if (!dec) return null
              return (
                <Card key={line.id} variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                      <Typography sx={{ fontWeight: 600 }}>{line.designation}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {line.quantity != null ? `${line.quantity} ${line.unit ?? ''}` : ''}
                        {line.lineTotalHt != null ? ` · ${formatEur(line.lineTotalHt)} HT` : ''}
                      </Typography>
                    </Stack>

                    {line.applied ? (
                      <Chip size="small" color="success" label="Déjà appliquée" sx={{ mt: 1 }} />
                    ) : (
                      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                        <TextField
                          select
                          size="small"
                          label="Action"
                          value={dec.action}
                          onChange={(e) => set(line.id, { action: e.target.value as InvoiceApplyAction })}
                          sx={{ maxWidth: 260 }}
                        >
                          <MenuItem value="UPDATE">Associer à une matière existante</MenuItem>
                          <MenuItem value="CREATE">Créer une nouvelle matière</MenuItem>
                          <MenuItem value="SKIP">Ignorer cette ligne</MenuItem>
                        </TextField>

                        {dec.action === 'UPDATE' && (
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                            <TextField
                              select
                              size="small"
                              label="Matière première"
                              value={dec.rawMaterialId === '' ? '' : String(dec.rawMaterialId)}
                              onChange={(e) =>
                                set(line.id, {
                                  rawMaterialId: e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              sx={{ flex: 1 }}
                            >
                              <MenuItem value="">— Choisir —</MenuItem>
                              {materials.map((m) => (
                                <MenuItem key={m.id} value={String(m.id)}>
                                  {m.name} ({m.referenceUnit})
                                </MenuItem>
                              ))}
                            </TextField>
                            <PriceField
                              dec={dec}
                              line={line}
                              materials={materials}
                              onChange={(v) => set(line.id, { pricePerUnit: v })}
                            />
                          </Stack>
                        )}

                        {dec.action === 'CREATE' && (
                          <Stack spacing={1.5}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                              <TextField
                                size="small"
                                label="Nom de la matière"
                                value={dec.newName}
                                onChange={(e) => set(line.id, { newName: e.target.value })}
                                sx={{ flex: 1 }}
                              />
                              <TextField
                                select
                                size="small"
                                label="Unité de réf."
                                value={dec.newReferenceUnit}
                                onChange={(e) =>
                                  set(line.id, { newReferenceUnit: e.target.value as MeasureUnit })
                                }
                                sx={{ width: { sm: 130 } }}
                              >
                                {UNITS.map((u) => (
                                  <MenuItem key={u} value={u}>
                                    {u}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <PriceField
                                dec={dec}
                                line={line}
                                materials={materials}
                                onChange={(v) => set(line.id, { pricePerUnit: v })}
                              />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                              <FamilleSelect
                                familles={familles}
                                familleId={dec.familleId}
                                sousFamilleId={dec.sousFamilleId}
                                onChange={(f, sf) => set(line.id, { familleId: f, sousFamilleId: sf })}
                                creatable
                                scope="RAW_MATERIAL"
                                onFamillesChanged={onFamillesChanged}
                              />
                            </Stack>
                          </Stack>
                        )}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {done && <Alert severity="success" sx={{ mt: 2 }}>{done}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
        <Button
          variant="contained"
          onClick={() => void apply()}
          disabled={busy || pendingCount === 0}
        >
          {busy ? 'Application…' : `Appliquer (${pendingCount})`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Champ prix par unité de référence, avec l'unité de la MP comme suffixe. */
function PriceField({
  dec,
  line,
  materials,
  onChange,
}: {
  dec: LineDecision
  line: InvoiceLine
  materials: RawMaterial[]
  onChange: (value: string) => void
}) {
  const refUnit =
    dec.action === 'CREATE'
      ? dec.newReferenceUnit
      : materials.find((m) => m.id === dec.rawMaterialId)?.referenceUnit ??
        line.suggestedReferenceUnit ??
        ''
  return (
    <TextField
      size="small"
      type="number"
      label={`Prix net HT${refUnit ? ` (€ / ${refUnit})` : ''}`}
      value={dec.pricePerUnit}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{ htmlInput: { step: '0.0001', min: '0' } }}
      sx={{ width: { sm: 190 } }}
    />
  )
}
