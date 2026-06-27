import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteIcon from '@mui/icons-material/Delete'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { PdfViewerModal } from '../../components/PdfViewerModal'
import { errorMessage } from '../../api/client'
import { getProfile, getSettings, logoUrl } from '../../api/billing'
import {
  getArticle,
  getCost,
  getRecipe,
  listArticles,
  listRawMaterials,
  listUnits,
  photoUrl,
  upsertRecipe,
} from '../../api/costing'
import type {
  Article,
  ComponentType,
  MeasureUnit,
  Pnet,
  RawMaterial,
  UnitInfo,
} from '../../api/types'

interface CompRow {
  type: ComponentType
  refId: number | ''
  quantity: string
  unit: MeasureUnit
}

function formatEur(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })
}

/** Télécharge une image et la convertit en data-URL (fiable pour react-pdf). */
async function toDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export function RecipeEditorPage() {
  const { id } = useParams()
  const articleId = Number(id)

  const [article, setArticle] = useState<Article | null>(null)
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [subArticles, setSubArticles] = useState<Article[]>([])

  // Mode de saisie : « à l'unité » (composants pour 1 pièce) ou « par lot » (+ rendement).
  const [recipeMode, setRecipeMode] = useState<'unite' | 'lot'>('unite')
  const [yieldQuantity, setYieldQuantity] = useState('1')
  const [yieldUnit, setYieldUnit] = useState<MeasureUnit>('PIECE')
  const [lossPercent, setLossPercent] = useState('0')
  const [method, setMethod] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [rows, setRows] = useState<CompRow[]>([])
  const [steps, setSteps] = useState<string[]>([])

  const [pnet, setPnet] = useState<Pnet | null>(null)
  const [pnetError, setPnetError] = useState<string | null>(null)
  // Marque de l'enseigne pour l'export PDF (logo + couleur principale).
  const [brandLogo, setBrandLogo] = useState<string | null>(null)
  const [brandColor, setBrandColor] = useState('#b5651d')
  const [exporting, setExporting] = useState<string | null>(null)
  const [pdfView, setPdfView] = useState<{ blob: Blob | null; name: string; title: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadCost = () => {
    getCost(articleId)
      .then((p) => {
        setPnet(p)
        setPnetError(null)
      })
      .catch((e) => {
        setPnet(null)
        setPnetError(errorMessage(e))
      })
  }

  useEffect(() => {
    // Marque de l'enseigne (logo + couleur) pour l'export PDF de la fiche.
    getProfile().then((p) => setBrandLogo(p.logoFile)).catch(() => undefined)
    getSettings()
      .then((s) => {
        if (s.brandColor1) setBrandColor(s.brandColor1)
      })
      .catch(() => undefined)

    Promise.all([getArticle(articleId), listUnits(), listRawMaterials(), listArticles()])
      .then(([art, u, mats, arts]) => {
        setArticle(art)
        setUnits(u)
        setMaterials(mats)
        setSubArticles(arts.filter((a) => a.type === 'FABRIQUE' && a.id !== articleId))
        setYieldUnit(art.unit)
      })
      .catch((e) => setError(errorMessage(e)))

    getRecipe(articleId)
      .then((r) => {
        setYieldQuantity(String(r.yieldQuantity))
        setYieldUnit(r.yieldUnit)
        setRecipeMode(Number(r.yieldQuantity) === 1 ? 'unite' : 'lot')
        setLossPercent(String(Math.round(r.lossRate * 1000) / 10))
        setMethod(r.method ?? '')
        setDurationMinutes(r.durationMinutes != null ? String(r.durationMinutes) : '')
        setRows(
          r.components.map((c) => ({
            type: c.type,
            refId: c.type === 'RAW' ? (c.rawMaterialId ?? '') : (c.subArticleId ?? ''),
            quantity: String(c.quantity),
            unit: c.unit,
          })),
        )
        setSteps(r.steps ?? [])
        loadCost()
      })
      .catch((e) => {
        // 404 = pas encore de recette : on démarre vide, pas une erreur.
        if (!(axios.isAxiosError(e) && e.response?.status === 404)) {
          setError(errorMessage(e))
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId])

  const addRow = () =>
    setRows((r) => [...r, { type: 'RAW', refId: '', quantity: '', unit: 'G' }])
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))
  const updateRow = (i: number, patch: Partial<CompRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))

  const addStep = () => setSteps((s) => [...s, ''])
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i))
  const updateStep = (i: number, value: string) =>
    setSteps((s) => s.map((step, idx) => (idx === i ? value : step)))
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const j = i + dir
      if (j < 0 || j >= s.length) return s
      const next = [...s]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await upsertRecipe(articleId, {
        yieldQuantity: recipeMode === 'unite' ? 1 : Number(yieldQuantity),
        yieldUnit: recipeMode === 'unite' ? (article?.unit ?? yieldUnit) : yieldUnit,
        lossRate: Number(lossPercent) / 100,
        method: method || null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        components: rows.map((row) => ({
          type: row.type,
          rawMaterialId: row.type === 'RAW' ? Number(row.refId) : null,
          subArticleId: row.type === 'SUBRECIPE' ? Number(row.refId) : null,
          quantity: Number(row.quantity),
          unit: row.unit,
        })),
        steps: steps.map((s) => s.trim()).filter((s) => s.length > 0),
      })
      loadCost()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Export PDF soigné via react-pdf (chargé à la demande pour ne pas alourdir le bundle).
  // mode = 'cost' (fiche coût, gérant) | 'prep' (fiche préparation, atelier) | 'both'.
  const exportPdf = async (mode: 'cost' | 'prep' | 'both') => {
    if (!article) return
    setExporting(mode)
    try {
      const [{ pdf }, { RecipePdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../../pdf/RecipePdf'),
      ])
      const photo = photoUrl(article.photoFile)
      const logo = brandLogo ? logoUrl(brandLogo) : null
      // react-pdf charge mal les URL distantes (service worker / CORS) : on convertit en data-URL.
      const [photoData, logoData] = await Promise.all([toDataUrl(photo), toDataUrl(logo)])
      const data = {
        name: article.name,
        code: article.code,
        gtin: article.gtin,
        salePriceTtc: article.salePriceTtc,
        pnet,
        steps,
        method,
        yieldQuantity,
        yieldUnit,
        lossPercent,
        durationMinutes,
        photoUrl: photoData,
        logoUrl: logoData,
        color: brandColor,
      }
      const blob = await pdf(<RecipePdf data={data} mode={mode} />).toBlob()
      const suffix = mode === 'cost' ? 'cout' : mode === 'prep' ? 'preparation' : 'fiche'
      setPdfView({
        blob,
        name: `${article.code}-${suffix}.pdf`,
        title: mode === 'cost' ? 'Fiche coût' : mode === 'prep' ? 'Fiche préparation' : 'Fiche recette',
      })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setExporting(null)
    }
  }

  if (!article) {
    return (
      <>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {error ?? 'Chargement…'}
        </Typography>
        <Button component={Link} to="/articles" variant="outlined" startIcon={<ArrowBackIcon />}>
          Articles
        </Button>
      </>
    )
  }

  return (
    <>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}
      >
        <Button
          component={Link}
          to="/articles"
          variant="outlined"
          size="small"
          startIcon={<ArrowBackIcon />}
        >
          Articles
        </Button>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={exporting === 'cost' ? <CircularProgress size={14} /> : <PictureAsPdfIcon />}
            onClick={() => exportPdf('cost')}
            disabled={!!exporting}
          >
            Fiche coût
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={exporting === 'prep' ? <CircularProgress size={14} /> : <PictureAsPdfIcon />}
            onClick={() => exportPdf('prep')}
            disabled={!!exporting}
          >
            Fiche préparation
          </Button>
        </Stack>
      </Stack>
      <Typography variant="h1" gutterBottom>
        Recette — {article.name}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, gap: 3 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Composition
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={recipeMode}
              onChange={(_, v) => {
                if (v) setRecipeMode(v)
              }}
              sx={{ mt: 1, mb: 1 }}
              aria-label="Mode de saisie de la recette"
            >
              <ToggleButton value="unite">À l'unité</ToggleButton>
              <ToggleButton value="lot">Par lot</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="body2" color="text.secondary">
              {recipeMode === 'unite' ? (
                <>
                  Saisissez les composants <strong>pour 1 {(article?.unit ?? 'pièce').toLowerCase()}</strong>.
                  Le coût de revient = somme des composants (ajusté de la perte).
                </>
              ) : (
                <>
                  Saisissez la recette <strong>pour un lot</strong>, puis indiquez le{' '}
                  <strong>rendement</strong> (ex. 120 pièces). Le coût de revient à l'unité = coût du
                  lot ÷ rendement (ajusté de la perte).
                </>
              )}
            </Typography>
            <form onSubmit={onSubmit}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                {recipeMode === 'lot' && (
                  <>
                    <TextField
                      label="Rendement (quantité produite)"
                      type="number"
                      value={yieldQuantity}
                      onChange={(e) => setYieldQuantity(e.target.value)}
                      required
                      slotProps={{ htmlInput: { step: '0.0001', min: '0' } }}
                    />
                    <TextField
                      select
                      label="Unité"
                      value={yieldUnit}
                      onChange={(e) => setYieldUnit(e.target.value as MeasureUnit)}
                    >
                      {units.map((u) => (
                        <MenuItem key={u.code} value={u.code}>
                          {u.code}
                        </MenuItem>
                      ))}
                    </TextField>
                  </>
                )}
                <TextField
                  label="Perte (%)"
                  type="number"
                  value={lossPercent}
                  onChange={(e) => setLossPercent(e.target.value)}
                  slotProps={{ htmlInput: { step: '0.1', min: '0', max: '99' } }}
                />
              </Stack>

              <Typography variant="h3" sx={{ mt: 3, mb: 1 }}>
                Composants
              </Typography>
              {rows.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Aucun composant. Ajoutez-en un.
                </Typography>
              )}
              <Stack spacing={1.5}>
                {rows.map((row, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr 1fr 1fr auto' },
                      gap: 1,
                      alignItems: 'center',
                    }}
                  >
                    <TextField
                      select
                      value={row.type}
                      onChange={(e) =>
                        updateRow(i, { type: e.target.value as ComponentType, refId: '' })
                      }
                    >
                      <MenuItem value="RAW">Matière</MenuItem>
                      <MenuItem value="SUBRECIPE">Sous-recette</MenuItem>
                    </TextField>
                    <TextField
                      select
                      value={row.refId}
                      onChange={(e) => updateRow(i, { refId: Number(e.target.value) })}
                      required
                    >
                      <MenuItem value="">— choisir —</MenuItem>
                      {(row.type === 'RAW' ? materials : subArticles).map((opt) => (
                        <MenuItem key={opt.id} value={opt.id}>
                          {opt.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      type="number"
                      placeholder="Qté"
                      value={row.quantity}
                      onChange={(e) => updateRow(i, { quantity: e.target.value })}
                      required
                      slotProps={{ htmlInput: { step: '0.0001', min: '0' } }}
                    />
                    <TextField
                      select
                      value={row.unit}
                      onChange={(e) => updateRow(i, { unit: e.target.value as MeasureUnit })}
                    >
                      {units.map((u) => (
                        <MenuItem key={u.code} value={u.code}>
                          {u.code}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Box sx={{ justifySelf: { xs: 'end', sm: 'auto' } }}>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" color="error" onClick={() => removeRow(i)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ))}
              </Stack>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={addRow}
                sx={{ mt: 1.5 }}
              >
                Composant
              </Button>

              <Stack spacing={2} sx={{ mt: 3 }}>
                <TextField
                  label="Méthode (optionnel)"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  multiline
                  minRows={3}
                />
                <TextField
                  label="Durée (minutes, optionnel)"
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  slotProps={{ htmlInput: { min: '0' } }}
                />
              </Stack>

              <Typography variant="h3" sx={{ mt: 3, mb: 1 }}>
                Étapes de préparation
              </Typography>
              {steps.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Aucune étape. Ajoutez-en une.
                </Typography>
              )}
              <Stack spacing={1.5}>
                {steps.map((step, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'auto 1fr', sm: 'auto 1fr auto' },
                      gap: 1,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Chip label={i + 1} size="small" sx={{ mt: 1 }} />
                    <TextField
                      multiline
                      minRows={1}
                      placeholder={`Étape ${i + 1}`}
                      value={step}
                      onChange={(e) => updateStep(i, e.target.value)}
                    />
                    <Stack
                      direction="row"
                      sx={{
                        gap: 0,
                        gridColumn: { xs: '1 / -1', sm: 'auto' },
                        justifyContent: { xs: 'flex-end', sm: 'flex-start' },
                      }}
                    >
                      <Tooltip title="Monter">
                        <span>
                          <IconButton size="small" disabled={i === 0} onClick={() => moveStep(i, -1)}>
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Descendre">
                        <span>
                          <IconButton
                            size="small"
                            disabled={i === steps.length - 1}
                            onClick={() => moveStep(i, 1)}
                          >
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" color="error" onClick={() => removeStep(i)}>
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
                onClick={addStep}
                sx={{ mt: 1.5 }}
              >
                Étape
              </Button>

              {error && (
                <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Button
                type="submit"
                variant="contained"
                disabled={busy}
                sx={{ mt: 2, width: { xs: '100%', sm: 'auto' } }}
              >
                {busy ? 'Enregistrement…' : 'Enregistrer la recette'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3, position: { md: 'sticky' }, top: 16, alignSelf: 'start' }}>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Coût de revient (PNET)
            </Typography>
            {pnetError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {pnetError}
              </Alert>
            )}
            {!pnet && !pnetError && (
              <Typography color="text.secondary">
                Enregistrez la recette pour calculer le PNET.
              </Typography>
            )}
            {pnet && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }} color="primary">
                    {formatEur(pnet.unitCost)}
                  </Typography>
                  <Typography color="text.secondary">/ {pnet.unit}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Lot : {formatEur(pnet.batchCost)} pour {pnet.effectiveYield} {pnet.yieldUnit} (perte
                  incluse)
                </Typography>
                <TableContainer sx={{ mt: 2, overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 320 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Composant</TableCell>
                        <TableCell>Qté</TableCell>
                        <TableCell>Coût</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pnet.lines.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            {l.label}{' '}
                            {l.type === 'SUBRECIPE' && (
                              <Chip label="sous-recette" size="small" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell>
                            {l.quantity} {l.unit}
                          </TableCell>
                          <TableCell>{formatEur(l.lineCost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </CardContent>
        </Card>
      </Box>

      <PdfViewerModal
        open={pdfView != null}
        onClose={() => setPdfView(null)}
        blob={pdfView?.blob ?? null}
        filename={pdfView?.name ?? 'fiche.pdf'}
        title={pdfView?.title}
      />
    </>
  )
}
