import { Fragment, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import EmailIcon from '@mui/icons-material/Email'
import HistoryIcon from '@mui/icons-material/History'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import RemoveIcon from '@mui/icons-material/Remove'
import SaveIcon from '@mui/icons-material/Save'
import { errorMessage } from '../../api/client'
import {
  createOrder,
  getOrder,
  listOrders,
  updateOrder,
  type OrderSheet,
  type PurchaseOrder,
} from '../../api/ordering'
import { useAuth } from '../../auth/AuthContext'
import { PdfViewerModal } from '../../components/PdfViewerModal'
import { SearchField } from '../../components/SearchField'
import { buildPurchaseOrderPdfBlob } from '../../pdf/buildPurchaseOrderPdf'
import { matchesQuery } from '../../utils/text'

/** Ligne libre : produit absent du cadencier (ex. « Kesko mousseline »). */
interface FreeLine {
  key: number
  designation: string
  packaging: string
  quantity: string
}

let freeKey = 1
const today = () => new Date().toISOString().slice(0, 10)
const num = (s: string | undefined) => {
  const n = Number((s ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000))
const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })

/**
 * Saisie d'une commande à partir d'un cadencier : une ligne par produit avec −/+ et quantité.
 * `tablet` agrandit les cibles tactiles (boutons 56 px, textes plus gros).
 */
export function OrderEntry({
  sheet,
  etablissement,
  order,
  tablet = false,
  onSaved,
}: {
  sheet: OrderSheet
  etablissement: { id: number; name: string }
  /** Commande existante (brouillon ou validée) à reprendre ; null pour une nouvelle commande. */
  order: PurchaseOrder | null
  tablet?: boolean
  onSaved: (order: PurchaseOrder, validated: boolean) => void
}) {
  const sheetLineIds = useMemo(() => new Set(sheet.lines.map((l) => l.id)), [sheet])
  const [qty, setQty] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    order?.lines.forEach((l) => {
      if (l.sheetLineId != null && sheetLineIds.has(l.sheetLineId)) init[l.sheetLineId] = fmtQty(l.quantity)
    })
    return init
  })
  const [free, setFree] = useState<FreeLine[]>(() =>
    (order?.lines ?? [])
      .filter((l) => l.sheetLineId == null || !sheetLineIds.has(l.sheetLineId))
      // Clés négatives : distinctes de celles créées ensuite par « Ajouter un produit ».
      .map((l, i) => ({ key: -(i + 1), designation: l.designation, packaging: l.packaging ?? '', quantity: fmtQty(l.quantity) })),
  )
  const [deliveryDate, setDeliveryDate] = useState(order?.deliveryDate ?? '')
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [search, setSearch] = useState('')
  const [onlyOrdered, setOnlyOrdered] = useState(false)
  const [busy, setBusy] = useState<'save' | 'validate' | 'last' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [current, setCurrent] = useState<PurchaseOrder | null>(order)
  const [pdf, setPdf] = useState<Blob | null>(null)

  const { me } = useAuth()
  // Téléphone : même en mode tablette, on garde des tailles compactes (écran ~375 px).
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'))
  const big = tablet && !phone
  const validated = current?.status === 'VALIDEE'
  const orderedCount =
    sheet.lines.filter((l) => l.id != null && num(qty[l.id]) > 0).length +
    free.filter((f) => f.designation.trim() && num(f.quantity) > 0).length

  // Montant indicatif : seulement pour les prix « par unité commandée » (sans unité de prix).
  const amount = sheet.showPrices
    ? sheet.lines.reduce(
        (sum, l) => sum + (l.id != null && l.unitPrice != null && !l.priceUnit ? l.unitPrice * num(qty[l.id]) : 0),
        0,
      )
    : 0

  const visible = sheet.lines.filter(
    (l) =>
      l.id != null &&
      (!onlyOrdered || num(qty[l.id]) > 0) &&
      matchesQuery(search, l.designation, l.designationAlt, l.code, l.section),
  )

  const step = (id: number, delta: number) =>
    setQty((q) => {
      const next = Math.max(0, num(q[id]) + delta)
      return { ...q, [id]: next ? fmtQty(next) : '' }
    })

  const lineInputs = () => [
    ...sheet.lines
      .filter((l) => l.id != null && num(qty[l.id]) > 0)
      .map((l) => ({ sheetLineId: l.id, quantity: num(qty[l.id as number]) })),
    ...free
      .filter((f) => f.designation.trim() && num(f.quantity) > 0)
      .map((f) => ({ sheetLineId: null, designation: f.designation.trim(), packaging: f.packaging.trim() || null, quantity: num(f.quantity) })),
  ]

  const save = async (validate: boolean) => {
    setError(null)
    setInfo(null)
    if (validate && orderedCount === 0) {
      setError('Saisissez au moins une quantité.')
      return
    }
    setBusy(validate ? 'validate' : 'save')
    try {
      const input = {
        sheetId: sheet.id,
        etablissementId: etablissement.id,
        orderDate: current?.orderDate ?? today(),
        deliveryDate: deliveryDate || null,
        notes: notes.trim() || null,
        validate,
        lines: lineInputs(),
      }
      const res = current ? await updateOrder(current.id, input) : await createOrder(input)
      setCurrent(res)
      setInfo(validate ? 'Commande validée.' : 'Brouillon enregistré.')
      onSaved(res, validate)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  /** Pré-remplit avec la dernière commande de ce cadencier pour cet établissement. */
  const fillFromLast = async () => {
    setError(null)
    setBusy('last')
    try {
      const last = (await listOrders()).find(
        (o) => o.sheetId === sheet.id && o.etablissementId === etablissement.id && o.id !== current?.id,
      )
      if (!last) {
        setInfo('Aucune commande précédente pour ce fournisseur.')
        return
      }
      const full = await getOrder(last.id)
      const next: Record<number, string> = {}
      full.lines.forEach((l) => {
        if (l.sheetLineId != null && sheetLineIds.has(l.sheetLineId)) next[l.sheetLineId] = fmtQty(l.quantity)
      })
      setQty(next)
      setInfo(`Quantités reprises de la commande du ${new Date(full.orderDate + 'T00:00:00').toLocaleDateString('fr-FR')}.`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  /**
   * Lien mailto : ouvre l'app mail de l'appareil avec destinataire, objet et commande déjà
   * rédigés (le mailto ne permet pas de joindre le PDF : la commande est écrite en texte).
   */
  const mailtoHref = () => {
    const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR')
    const lines = [
      ...sheet.lines
        .filter((l) => l.id != null && num(qty[l.id]) > 0)
        .map((l) => {
          const details = [l.code ? `réf. ${l.code}` : null, l.packaging].filter(Boolean).join(' – ')
          return `- ${fmtQty(num(qty[l.id as number]))} × ${l.designation}${details ? ` (${details})` : ''}`
        }),
      ...free
        .filter((f) => f.designation.trim() && num(f.quantity) > 0)
        .map((f) => `- ${fmtQty(num(f.quantity))} × ${f.designation.trim()}${f.packaging.trim() ? ` (${f.packaging.trim()})` : ''}`),
    ]
    const subject = `Commande ${etablissement.name} — ${fmtDate(current?.orderDate ?? today())}`
    const body = [
      'Bonjour,',
      '',
      `Voici notre commande pour ${etablissement.name} :`,
      '',
      ...lines,
      '',
      deliveryDate ? `Livraison souhaitée : ${fmtDate(deliveryDate)}` : null,
      notes.trim() ? `Remarques : ${notes.trim()}` : null,
      deliveryDate || notes.trim() ? '' : null,
      'Merci de nous confirmer la bonne réception.',
      '',
      'Cordialement,',
      me?.fullName ?? '',
      etablissement.name,
    ]
      .filter((x) => x !== null)
      .join('\n')
    return `mailto:${encodeURIComponent(sheet.supplierEmail ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const showPdf = async () => {
    setBusy('pdf')
    try {
      const lines = [
        ...sheet.lines
          .filter((l) => l.id != null && num(qty[l.id]) > 0)
          .map((l) => ({ ...l, quantity: num(qty[l.id as number]) })),
        ...free
          .filter((f) => f.designation.trim() && num(f.quantity) > 0)
          .map((f) => ({
            section: null,
            code: null,
            designation: f.designation.trim(),
            packaging: f.packaging.trim() || null,
            unitPrice: null,
            priceUnit: null,
            quantity: num(f.quantity),
          })),
      ]
      setPdf(
        await buildPurchaseOrderPdfBlob(
          {
            title: sheet.name,
            supplierName: sheet.supplierName,
            etablissementName: etablissement.name,
            orderDate: current?.orderDate ?? today(),
            deliveryDate: deliveryDate || null,
            notes: notes.trim() || null,
            createdByName: current?.createdByName ?? null,
            color: sheet.color ?? '#1f4e79',
            showPrices: sheet.showPrices,
            lines,
          },
          'order',
        ),
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const btn = big ? 56 : phone ? 44 : 36
  // Boutons de la barre du bas sur téléphone : icône au-dessus du libellé (4 colonnes étroites).
  const barBtnSx = phone
    ? ({ flexDirection: 'column', gap: 0.25, py: 0.75, minWidth: 0, fontSize: 12, '& .MuiButton-startIcon': { m: 0 } } as const)
    : undefined

  return (
    <Box sx={{ pb: phone ? 20 : big ? 14 : 10 }}>
      {/* En-tête : livraison, notes, filtres. */}
      {/* Grille (et non Stack) : le thème met les champs en fullWidth, ce qui écrasait les remarques. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '200px 1fr auto' },
          gap: 2,
          mb: 2,
          alignItems: 'center',
        }}
      >
        <TextField
          label="Livraison souhaitée"
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          disabled={validated}
        />
        <TextField
          label="Remarques pour le fournisseur"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={validated}
        />
        {!validated && (
          <Button
            variant="outlined"
            startIcon={busy === 'last' ? <CircularProgress size={16} /> : <HistoryIcon />}
            onClick={() => void fillFromLast()}
            disabled={busy != null}
            size={big ? 'large' : 'medium'}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Reprendre la dernière commande
          </Button>
        )}
      </Box>

      {sheet.notes && <Alert severity="info" sx={{ mb: 2 }}>{sheet.notes}</Alert>}
      {validated && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
          Commande validée{current?.validatedAt ? ` le ${new Date(current.validatedAt).toLocaleString('fr-FR')}` : ''}.
          Seul le patron peut la rouvrir pour la modifier.
          {!sheet.supplierEmail && ' Pas d’e-mail fournisseur dans le cadencier : saisissez le destinataire dans le mail.'}
        </Alert>
      )}

      <Stack
        direction="row"
        spacing={2}
        sx={{
          mb: 1,
          alignItems: 'center',
          position: 'sticky',
          top: tablet ? 0 : 64,
          zIndex: 2,
          bgcolor: 'background.default',
          py: 1,
        }}
      >
        <SearchField value={search} onChange={setSearch} placeholder="Chercher un produit" sx={{ flex: 1 }} />
        <FormControlLabel
          control={<Switch checked={onlyOrdered} onChange={(e) => setOnlyOrdered(e.target.checked)} />}
          label="Commandés"
        />
      </Stack>

      <Paper variant="outlined">
        {visible.length === 0 && (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            {onlyOrdered ? 'Aucun produit commandé pour l’instant.' : 'Aucun produit ne correspond.'}
          </Typography>
        )}
        {visible.map((l, i) => {
          const id = l.id as number
          const q = num(qty[id])
          const showSection = l.section && l.section !== visible[i - 1]?.section && !search
          return (
            <Fragment key={id}>
              {showSection && (
                <Typography
                  sx={{ px: 2, py: 0.75, bgcolor: 'action.hover', fontWeight: 700, fontSize: big ? 16 : 14 }}
                >
                  {l.section}
                </Typography>
              )}
              <Stack
                direction="row"
                sx={{
                  px: { xs: 1, sm: 2 },
                  py: big ? 1.25 : 0.75,
                  gap: 1,
                  alignItems: 'center',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: q > 0 ? 'rgba(46, 125, 50, 0.08)' : undefined,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: q > 0 ? 700 : 500, fontSize: big ? 18 : 15, lineHeight: 1.3 }}>
                    {l.designation}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: big ? 14 : 12.5 }}>
                    {[
                      l.code,
                      l.designationAlt,
                      l.packaging,
                      sheet.showPrices && l.unitPrice != null
                        ? `${eur(l.unitPrice)}${l.priceUnit ? ` / ${l.priceUnit}` : ''}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  <IconButton
                    aria-label="Moins"
                    onClick={() => step(id, -1)}
                    disabled={validated || q === 0}
                    sx={{ width: btn, height: btn, border: '1px solid', borderColor: 'divider' }}
                  >
                    <RemoveIcon fontSize={big ? 'medium' : 'small'} />
                  </IconButton>
                  <TextField
                    value={qty[id] ?? ''}
                    onChange={(e) => setQty((s) => ({ ...s, [id]: e.target.value.replace(/[^0-9.,]/g, '') }))}
                    onFocus={(e) => e.target.select()}
                    disabled={validated}
                    placeholder="0"
                    size={big ? 'medium' : 'small'}
                    slotProps={{
                      htmlInput: {
                        inputMode: 'decimal',
                        style: { textAlign: 'center', fontWeight: 700, fontSize: big ? 20 : 15 },
                        'aria-label': `Quantité ${l.designation}`,
                      },
                    }}
                    sx={{ width: big ? 84 : phone ? 56 : 64 }}
                  />
                  <IconButton
                    aria-label="Plus"
                    color="primary"
                    onClick={() => step(id, 1)}
                    disabled={validated}
                    sx={{ width: btn, height: btn, border: '1px solid', borderColor: 'primary.main' }}
                  >
                    <AddIcon fontSize={big ? 'medium' : 'small'} />
                  </IconButton>
                </Stack>
              </Stack>
            </Fragment>
          )
        })}
      </Paper>

      {/* Produits hors cadencier. */}
      <Typography variant="h3" sx={{ mt: 3, mb: 1 }}>
        Autres produits (hors cadencier)
      </Typography>
      <Stack spacing={1}>
        {free.map((f) => (
          <Box
            key={f.key}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 72px 40px', sm: '2fr 1fr 90px 40px' },
              gap: 1,
              alignItems: 'center',
            }}
          >
            <TextField
              placeholder="Produit"
              value={f.designation}
              onChange={(e) => setFree((fs) => fs.map((x) => (x.key === f.key ? { ...x, designation: e.target.value } : x)))}
              disabled={validated}
              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
            />
            <TextField
              placeholder="Conditionnement"
              value={f.packaging}
              onChange={(e) => setFree((fs) => fs.map((x) => (x.key === f.key ? { ...x, packaging: e.target.value } : x)))}
              disabled={validated}
            />
            <TextField
              placeholder="Qté"
              value={f.quantity}
              onChange={(e) =>
                setFree((fs) => fs.map((x) => (x.key === f.key ? { ...x, quantity: e.target.value.replace(/[^0-9.,]/g, '') } : x)))
              }
              disabled={validated}
              slotProps={{ htmlInput: { inputMode: 'decimal', style: { textAlign: 'center' } } }}
            />
            {!validated && (
              <IconButton color="error" onClick={() => setFree((fs) => fs.filter((x) => x.key !== f.key))}>
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        ))}
      </Stack>
      {!validated && (
        <Button
          startIcon={<AddIcon />}
          onClick={() => setFree((fs) => [...fs, { key: freeKey++, designation: '', packaging: '', quantity: '' }])}
          sx={{ mt: 1 }}
          size={big ? 'large' : 'medium'}
        >
          Ajouter un produit
        </Button>
      )}

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {info && <Alert severity="success" sx={{ mt: 2 }} onClose={() => setInfo(null)}>{info}</Alert>}

      {/* Barre d'actions fixée en bas d'écran. */}
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          px: phone ? 1 : 2,
          pt: big ? 1.5 : 1,
          pb: `calc(${big ? 12 : 8}px + env(safe-area-inset-bottom))`,
          // Téléphone : résumé sur une ligne puis boutons en grille égale ; sinon tout en ligne.
          display: 'grid',
          gridTemplateColumns: phone ? `repeat(${validated ? 2 : 4}, 1fr)` : `1fr repeat(${validated ? 2 : 4}, auto)`,
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0, gridColumn: phone ? '1 / -1' : 'auto' }}>
          <Typography sx={{ fontWeight: 700, fontSize: big ? 18 : 15 }}>
            {orderedCount} produit{orderedCount > 1 ? 's' : ''} commandé{orderedCount > 1 ? 's' : ''}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
              {sheet.name} · {etablissement.name}
            </Typography>
            {current && <Chip size="small" label={validated ? 'Validée' : 'Brouillon'} color={validated ? 'success' : 'default'} />}
            {amount > 0 && (
              <Typography variant="body2" color="text.secondary">
                ≈ {eur(amount)} HT
              </Typography>
            )}
          </Stack>
        </Box>
        <Button
          variant="outlined"
          size={big ? 'large' : 'medium'}
          sx={barBtnSx}
          startIcon={busy === 'pdf' ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
          onClick={() => void showPdf()}
          disabled={busy != null || orderedCount === 0}
        >
          {phone ? 'PDF' : 'Bon PDF'}
        </Button>
        <Button
          // Une fois validée, l'envoi devient l'action principale : un appui ouvre le mail prêt à partir.
          variant={validated ? 'contained' : 'outlined'}
          size={big ? 'large' : 'medium'}
          sx={barBtnSx}
          startIcon={<EmailIcon />}
          href={mailtoHref()}
          disabled={orderedCount === 0}
        >
          {phone ? 'E-mail' : 'Envoyer par e-mail'}
        </Button>
        {!validated && (
          <>
            <Button
              variant="outlined"
              size={big ? 'large' : 'medium'}
          sx={barBtnSx}
              startIcon={busy === 'save' ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={() => void save(false)}
              disabled={busy != null}
            >
              Brouillon
            </Button>
            <Button
              variant="contained"
              color="success"
              size={big ? 'large' : 'medium'}
          sx={barBtnSx}
              startIcon={busy === 'validate' ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
              onClick={() => {
                if (window.confirm(`Valider la commande ${sheet.name} (${orderedCount} produit(s)) ?`)) void save(true)
              }}
              disabled={busy != null || orderedCount === 0}
            >
              Valider
            </Button>
          </>
        )}
      </Paper>

      <PdfViewerModal
        open={pdf != null}
        onClose={() => setPdf(null)}
        blob={pdf}
        filename={`commande-${sheet.name}-${current?.orderDate ?? today()}.pdf`}
        title={`Bon de commande ${sheet.name}`}
        copyOnShare={sheet.supplierEmail}
      />
    </Box>
  )
}
