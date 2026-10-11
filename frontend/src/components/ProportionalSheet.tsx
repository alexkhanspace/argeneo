import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { errorMessage } from '../api/client'
import {
  buildPropTable,
  formatQty,
  MAX_ROWS,
  weightRange,
  type PropIngredient,
} from '../utils/proportional'
import { Modal } from './Modal'
import { PdfViewerModal } from './PdfViewerModal'

/**
 * Fiche proportionnelle : quantités de chaque ingrédient (colonnes) pour une plage de poids
 * de fabrication (lignes), de « min » à « max » par « pas » (en kg).
 */
export function ProportionalSheet({
  open,
  onClose,
  name,
  code,
  ingredients,
  color = '#b5651d',
}: {
  open: boolean
  onClose: () => void
  name: string
  code?: string
  ingredients: PropIngredient[]
  color?: string
}) {
  const [min, setMin] = useState('10')
  const [max, setMax] = useState('60')
  const [step, setStep] = useState('10')
  const [pdf, setPdf] = useState<Blob | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weights = useMemo(() => weightRange(Number(min), Number(max), Number(step)), [min, max, step])
  const table = useMemo(() => buildPropTable(ingredients, weights), [ingredients, weights])
  const truncated = weights.length >= MAX_ROWS

  const exportPdf = async () => {
    if (!table) return
    setError(null)
    setBusy(true)
    try {
      const [{ pdf: render }, { ProportionalPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../pdf/ProportionalPdf'),
      ])
      setPdf(await render(<ProportionalPdf name={name} code={code} table={table} color={color} />).toBlob())
      setPdfOpen(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Fiche proportionnelle — ${name}`} maxWidth="lg">
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          <TextField
            label="De (kg)"
            type="number"
            size="small"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            slotProps={{ htmlInput: { step: 'any', min: '0' } }}
          />
          <TextField
            label="À (kg)"
            type="number"
            size="small"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            slotProps={{ htmlInput: { step: 'any', min: '0' } }}
          />
          <TextField
            label="Intervalle (kg)"
            type="number"
            size="small"
            value={step}
            onChange={(e) => setStep(e.target.value)}
            slotProps={{ htmlInput: { step: 'any', min: '0' } }}
          />
          <Button
            variant="outlined"
            startIcon={busy ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
            onClick={() => void exportPdf()}
            disabled={!table || weights.length === 0 || busy}
            sx={{ flexShrink: 0 }}
          >
            PDF
          </Button>
        </Stack>

        {!table ? (
          <Alert severity="info">
            Aucun ingrédient en poids ou en volume : renseignez la recette (g, kg, ml, l) pour calculer
            les proportions.
          </Alert>
        ) : weights.length === 0 ? (
          <Alert severity="warning">Bornes invalides : « De » &gt; 0, « À » ≥ « De » et intervalle &gt; 0.</Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              Recette de base : {formatQty(table.baseKg, 3)} kg (somme des ingrédients ; volumes comptés à
              1 l = 1 kg).
              {truncated && ` Limité à ${MAX_ROWS} lignes.`}
            </Typography>
            <TableContainer sx={{ maxHeight: '60vh', overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Fabrication</TableCell>
                    {table.columns.map((c, i) => (
                      <TableCell key={i} align="right" sx={{ fontWeight: 700 }}>
                        {c.label}
                        <Box component="span" sx={{ display: 'block', fontWeight: 400, color: 'text.secondary' }}>
                          {c.unit}
                          {c.percent != null && ` · ${formatQty(c.percent, 1)} %`}
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {table.weights.map((w, r) => (
                    <TableRow key={w} hover>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatQty(w, 3)} kg</TableCell>
                      {table.values[r].map((v, c) => (
                        <TableCell key={c} align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {formatQty(v, table.columns[c].decimals)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>

      <PdfViewerModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        blob={pdf}
        filename={`${code ?? 'recette'}-proportionnelle.pdf`}
        title="Fiche proportionnelle"
      />
    </Modal>
  )
}
