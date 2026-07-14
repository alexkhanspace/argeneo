import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import { errorMessage } from '../../api/client'
import {
  createDocument,
  getDocument,
  listClients,
  setDocumentStatus,
  updateDocument,
  type Client,
  type DocumentType,
} from '../../api/billing'
import { listArticles } from '../../api/costing'
import type { Article } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'

// Dates de facturation en local (évite le décalage de fuseau de toISOString).
const pad2 = (x: number): string => String(x).padStart(2, '0')
const billToday = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
const billAddDays = (iso: string, n: number): string => {
  const base = iso ? new Date(iso + 'T00:00:00') : new Date()
  base.setDate(base.getDate() + n)
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`
}

interface LineRow {
  designation: string
  articleId: number | ''
  quantity: string
  unit: string
  unitPriceHt: string
  vatRate: string
  discountRate: string
}

const EMPTY_LINE: LineRow = {
  designation: '',
  articleId: '',
  quantity: '1',
  unit: '',
  unitPriceHt: '0',
  vatRate: '0.20',
  discountRate: '0',
}

function formatEur(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function DocumentEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isNew = id === undefined
  const docId = isNew ? null : Number(id)

  const [type, setType] = useState<DocumentType>(
    (searchParams.get('type') as DocumentType) ?? 'DEVIS',
  )
  const [number, setNumber] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('BROUILLON')
  const [clients, setClients] = useState<Client[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [clientId, setClientId] = useState<number | ''>('')
  const [issueDate, setIssueDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [lines, setLines] = useState<LineRow[]>([{ ...EMPTY_LINE }])

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listClients().then(setClients).catch((e) => setError(errorMessage(e)))
    listArticles().then(setArticles).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (docId == null) return
    getDocument(docId)
      .then((doc) => {
        setType(doc.type)
        setNumber(doc.number)
        setStatus(doc.status)
        setClientId(doc.clientId)
        setIssueDate(doc.issueDate ?? '')
        setDueDate(doc.dueDate ?? '')
        setNotes(doc.notes ?? '')
        setTerms(doc.terms ?? '')
        setLines(
          doc.lines.length === 0
            ? [{ ...EMPTY_LINE }]
            : doc.lines.map((l) => ({
                designation: l.designation,
                articleId: l.articleId ?? '',
                quantity: String(l.quantity),
                unit: l.unit ?? '',
                unitPriceHt: String(l.unitPriceHt),
                vatRate: String(l.vatRate),
                discountRate: String(l.discountRate),
              })),
        )
      })
      .catch((e) => setError(errorMessage(e)))
  }, [docId])

  const updateLine = (index: number, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  const onPickArticle = (index: number, articleId: number | '') => {
    if (articleId === '') {
      updateLine(index, { articleId: '' })
      return
    }
    const article = articles.find((a) => a.id === articleId)
    if (!article) {
      updateLine(index, { articleId })
      return
    }
    const ht = article.salePriceHt ?? article.salePriceTtc ?? 0
    updateLine(index, {
      articleId,
      designation: article.name,
      unit: article.unit,
      unitPriceHt: ht != null ? String(ht) : '0',
      vatRate: article.vatRate != null ? String(article.vatRate) : '0.20',
    })
  }

  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }])
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))

  const totals = useMemo(() => {
    let ht = 0
    let vat = 0
    for (const l of lines) {
      const qty = Number(l.quantity) || 0
      const pu = Number(l.unitPriceHt) || 0
      const discount = Number(l.discountRate) || 0
      const rate = Number(l.vatRate) || 0
      const lineHt = round2(qty * pu * (1 - discount))
      ht += lineHt
      vat += lineHt * rate
    }
    ht = round2(ht)
    vat = round2(vat)
    return { ht, vat, ttc: round2(ht + vat) }
  }, [lines])

  const buildPayload = () => ({
    clientId: Number(clientId),
    issueDate: issueDate || null,
    dueDate: dueDate || null,
    notes: notes || null,
    terms: terms || null,
    lines: lines
      .filter((l) => l.designation.trim() !== '')
      .map((l) => ({
        designation: l.designation,
        articleId: l.articleId === '' ? null : l.articleId,
        quantity: Number(l.quantity) || 0,
        unit: l.unit || null,
        unitPriceHt: Number(l.unitPriceHt) || 0,
        vatRate: Number(l.vatRate) || 0,
        discountRate: Number(l.discountRate) || 0,
      })),
  })

  const save = async (): Promise<number | null> => {
    if (clientId === '') {
      setError('Sélectionnez un client.')
      return null
    }
    setError(null)
    setBusy(true)
    try {
      const payload = buildPayload()
      const saved = docId == null
        ? await createDocument(type, payload)
        : await updateDocument(docId, payload)
      return saved.id
    } catch (err) {
      setError(errorMessage(err))
      return null
    } finally {
      setBusy(false)
    }
  }

  const onSave = async () => {
    const savedId = await save()
    if (savedId != null) navigate(`/billing/documents/${savedId}`)
  }

  const onEmit = async () => {
    const savedId = await save()
    if (savedId == null) return
    try {
      await setDocumentStatus(savedId, 'EMIS')
      navigate('/billing')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const title = isNew
    ? type === 'DEVIS'
      ? 'Nouveau devis'
      : 'Nouvelle facture'
    : `${type === 'DEVIS' ? 'Devis' : 'Facture'} ${number ?? '(brouillon)'}`

  const readOnly = status !== 'BROUILLON'

  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          <Button
            component={Link}
            to="/billing"
            size="small"
            startIcon={<ArrowBackIcon />}
            sx={{ pl: 0 }}
          >
            Retour à la facturation
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Ce document n'est plus un brouillon ; les modifications enregistrées resteront possibles
          mais le numéro est figé.
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value === '' ? '' : Number(e.target.value))}
                sx={{ minWidth: { xs: 0, sm: 260 }, width: { xs: '100%', sm: 'auto' } }}
                required
              >
                {clients.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              <Stack spacing={0.5}>
                <TextField
                  label="Date d'émission"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                />
                <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => setIssueDate(billToday())}>
                  Aujourd'hui
                </Button>
              </Stack>
              <Stack spacing={0.5}>
                <TextField
                  label="Échéance"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                />
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={() => setDueDate(issueDate || billToday())}>
                    Réception
                  </Button>
                  <Button size="small" onClick={() => setDueDate(billAddDays(issueDate, 30))}>
                    +30 j
                  </Button>
                  <Button size="small" onClick={() => setDueDate(billAddDays(issueDate, 60))}>
                    +60 j
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Lignes
          </Typography>
          <Box sx={{ overflowX: 'auto', width: '100%' }}>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 200 }}>Désignation</TableCell>
                <TableCell sx={{ minWidth: 160 }}>Article</TableCell>
                <TableCell align="right">Qté</TableCell>
                <TableCell>Unité</TableCell>
                <TableCell align="right">PU HT</TableCell>
                <TableCell align="right">TVA</TableCell>
                <TableCell align="right">Remise</TableCell>
                <TableCell align="right">Total HT</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line, i) => {
                const lineHt = round2(
                  (Number(line.quantity) || 0) *
                    (Number(line.unitPriceHt) || 0) *
                    (1 - (Number(line.discountRate) || 0)),
                )
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <TextField
                        value={line.designation}
                        onChange={(e) => updateLine(i, { designation: e.target.value })}
                        fullWidth
                        variant="standard"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        value={line.articleId}
                        onChange={(e) =>
                          onPickArticle(i, e.target.value === '' ? '' : Number(e.target.value))
                        }
                        fullWidth
                        variant="standard"
                      >
                        <MenuItem value="">—</MenuItem>
                        {articles.map((a) => (
                          <MenuItem key={a.id} value={a.id}>
                            {a.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(i, { quantity: e.target.value })}
                        variant="standard"
                        slotProps={{ htmlInput: { step: '0.001', min: '0', style: { textAlign: 'right', width: 70 } } }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={line.unit}
                        onChange={(e) => updateLine(i, { unit: e.target.value })}
                        variant="standard"
                        sx={{ width: 60 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={line.unitPriceHt}
                        onChange={(e) => updateLine(i, { unitPriceHt: e.target.value })}
                        variant="standard"
                        slotProps={{ htmlInput: { step: '0.0001', min: '0', style: { textAlign: 'right', width: 90 } } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={line.vatRate}
                        onChange={(e) => updateLine(i, { vatRate: e.target.value })}
                        variant="standard"
                        slotProps={{ htmlInput: { step: '0.01', min: '0', max: '1', style: { textAlign: 'right', width: 60 } } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={line.discountRate}
                        onChange={(e) => updateLine(i, { discountRate: e.target.value })}
                        variant="standard"
                        slotProps={{ htmlInput: { step: '0.01', min: '0', max: '1', style: { textAlign: 'right', width: 60 } } }}
                      />
                    </TableCell>
                    <TableCell align="right">{formatEur(lineHt)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Supprimer la ligne">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeLine(i)}
                            disabled={lines.length === 1}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </Box>
          <Button startIcon={<AddIcon />} onClick={addLine} sx={{ mt: 1 }}>
            Ajouter une ligne
          </Button>

          <Divider sx={{ my: 2 }} />
          <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
            <Typography variant="body2">Total HT : {formatEur(totals.ht)}</Typography>
            <Typography variant="body2">TVA : {formatEur(totals.vat)}</Typography>
            <Typography variant="h6">Total TTC : {formatEur(totals.ttc)}</Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
            />
            <TextField
              label="Conditions"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              multiline
              minRows={2}
            />
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: { xs: 'stretch', sm: 'flex-end' },
        }}
      >
        <Button
          variant="outlined"
          onClick={onSave}
          disabled={busy}
          fullWidth
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Enregistrer
        </Button>
        {status === 'BROUILLON' && (
          <Button
            variant="contained"
            onClick={onEmit}
            disabled={busy}
            fullWidth
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Enregistrer & Émettre
          </Button>
        )}
      </Box>
    </>
  )
}
