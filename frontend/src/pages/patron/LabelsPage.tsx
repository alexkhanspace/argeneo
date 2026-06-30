import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import SaveIcon from '@mui/icons-material/Save'
import { errorMessage } from '../../api/client'
import { listArticles } from '../../api/costing'
import { listMyEtablissements } from '../../api/daily'
import { getProfile, logoUrl } from '../../api/billing'
import type { Article } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { PdfViewerModal } from '../../components/PdfViewerModal'
import { buildLabelsPdfBlob } from '../../pdf/buildLabelsPdf'
import type { LabelItem } from '../../pdf/LabelsPdf'

const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '10 × 6', w: 10, h: 6 },
  { label: '6 × 10', w: 6, h: 10 },
  { label: '8 × 5', w: 8, h: 5 },
  { label: '5 × 3', w: 5, h: 3 },
]

const COLOR_PRESETS: { label: string; bg: string; text: string }[] = [
  { label: 'Blanc / Noir', bg: '#ffffff', text: '#111111' },
  { label: 'Noir / Blanc', bg: '#111111', text: '#ffffff' },
  { label: 'Terracotta', bg: '#c2410c', text: '#ffffff' },
  { label: 'Crème / Brun', bg: '#f5f1e8', text: '#5b3a1a' },
]

type Frame = 'none' | 'wood'
const THEMES: { label: string; bg: string; text: string; frame: Frame; chalk: boolean }[] = [
  { label: 'Libre', bg: '#ffffff', text: '#111111', frame: 'none', chalk: false },
  { label: 'Ardoise', bg: '#24221f', text: '#f1ede4', frame: 'none', chalk: true },
  { label: 'Ardoise + cadre bois', bg: '#24221f', text: '#f1ede4', frame: 'wood', chalk: true },
  { label: 'Bois (cadre)', bg: '#f4ead7', text: '#4a2f15', frame: 'wood', chalk: false },
  { label: 'Kraft', bg: '#cdb48c', text: '#3a2913', frame: 'none', chalk: false },
]
const CHALK_CSS = '"Permanent Marker", "Bricolage Grotesque", cursive'

const eur = (v: number | null): string | null =>
  v == null ? null : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

/** Modèle d'étiquette enregistré (mise en forme réutilisable, hors sélection de produits). */
interface LabelTemplate {
  id: string
  name: string
  brand: string
  bgColor: string
  textColor: string
  widthCm: string
  heightCm: string
  fontScale: number
  showPrice: boolean
  extraText?: string
  useDescription?: boolean
  frame?: Frame
  chalk?: boolean
}

const TPL_KEY = 'argeneo.labelTemplates'
const loadTemplates = (): LabelTemplate[] => {
  try {
    const v = JSON.parse(localStorage.getItem(TPL_KEY) ?? '[]')
    return Array.isArray(v) ? (v as LabelTemplate[]) : []
  } catch {
    return []
  }
}
const persistTemplates = (t: LabelTemplate[]) => localStorage.setItem(TPL_KEY, JSON.stringify(t))

/** Générateur d'étiquettes : sélection de produits + modèle (couleurs, logo) → planche A4 à découper. */
export function LabelsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [search, setSearch] = useState('')
  // id article → quantité (présence dans l'objet = sélectionné).
  const [sel, setSel] = useState<Record<number, number>>({})
  const [brand, setBrand] = useState('')
  const [widthCm, setWidthCm] = useState('10')
  const [heightCm, setHeightCm] = useState('6')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [textColor, setTextColor] = useState('#111111')
  const [frame, setFrame] = useState<Frame>('none')
  const [chalk, setChalk] = useState(false)
  const [fontScale, setFontScale] = useState(1)
  const [showPrice, setShowPrice] = useState(true)
  // Texte libre (allergènes, promo…) commun à toutes les étiquettes.
  const [extraText, setExtraText] = useState('')
  // Reprend la description du produit (ingrédients) sur chaque étiquette.
  const [useDescription, setUseDescription] = useState(false)
  const [logoSrc, setLogoSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [templates, setTemplates] = useState<LabelTemplate[]>(() => loadTemplates())
  const [tplName, setTplName] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdf, setPdf] = useState<Blob | null>(null)

  useEffect(() => {
    listArticles()
      .then((list) => setArticles(list.filter((a) => a.active)))
      .catch((e) => setError(errorMessage(e)))
    listMyEtablissements()
      .then((list) => {
        if (list.length > 0) setBrand((b) => b || list[0].name)
      })
      .catch(() => undefined)
    getProfile()
      .then((p) => setLogoSrc(p.logoFile ? logoUrl(p.logoFile) : null))
      .catch(() => undefined)
  }, [])

  const saveTemplate = () => {
    const name = tplName.trim()
    if (!name) return
    const tpl: LabelTemplate = {
      id: `${Date.now()}`,
      name,
      brand,
      bgColor,
      textColor,
      widthCm,
      heightCm,
      fontScale,
      showPrice,
      extraText,
      useDescription,
      frame,
      chalk,
    }
    // Remplace un modèle de même nom, sinon ajoute.
    const next = [...templates.filter((t) => t.name !== name), tpl]
    setTemplates(next)
    persistTemplates(next)
    setTplName('')
  }

  const applyTemplate = (t: LabelTemplate) => {
    setBrand(t.brand)
    setBgColor(t.bgColor)
    setTextColor(t.textColor)
    setWidthCm(t.widthCm)
    setHeightCm(t.heightCm)
    setFontScale(t.fontScale ?? 1)
    setShowPrice(t.showPrice)
    setExtraText(t.extraText ?? '')
    setUseDescription(t.useDescription ?? false)
    setFrame(t.frame ?? 'none')
    setChalk(t.chalk ?? false)
  }

  const deleteTemplate = (id: string) => {
    const next = templates.filter((t) => t.id !== id)
    setTemplates(next)
    persistTemplates(next)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q))
  }, [articles, search])

  const total = useMemo(() => Object.values(sel).reduce((s, n) => s + n, 0), [sel])

  // Nom d'exemple pour l'aperçu : 1er produit sélectionné, sinon générique.
  const previewName = useMemo(() => {
    const firstId = articles.find((a) => a.id in sel)?.id
    return (firstId != null && articles.find((a) => a.id === firstId)?.name) || 'Croissant choco noisette'
  }, [articles, sel])

  const previewNote = useMemo(() => {
    const parts: string[] = []
    if (useDescription) {
      const first = articles.find((a) => a.id in sel)
      parts.push(first?.description || 'Ingrédients du produit…')
    }
    if (extraText.trim()) parts.push(extraText.trim())
    return parts.length ? parts.join(' · ') : null
  }, [useDescription, extraText, articles, sel])

  const toggle = (id: number) =>
    setSel((prev) => {
      const next = { ...prev }
      if (id in next) delete next[id]
      else next[id] = 1
      return next
    })

  const setQty = (id: number, n: number) =>
    setSel((prev) => ({ ...prev, [id]: Math.max(1, Math.min(999, Math.round(n) || 1)) }))

  const generate = async () => {
    setError(null)
    setBusy(true)
    try {
      const items: LabelItem[] = []
      const extra = extraText.trim()
      for (const a of articles) {
        const qty = sel[a.id]
        if (!qty) continue
        const price = showPrice ? eur(a.salePriceTtc) : null
        const noteParts: string[] = []
        if (useDescription && a.description) noteParts.push(a.description)
        if (extra) noteParts.push(extra)
        const note = noteParts.length ? noteParts.join(' · ') : null
        for (let i = 0; i < qty; i++) items.push({ name: a.name, price, note })
      }
      const w = Math.max(2, Math.min(20, Number(widthCm) || 10))
      const h = Math.max(2, Math.min(28, Number(heightCm) || 6))
      const blob = await buildLabelsPdfBlob({
        items,
        widthMm: w * 10,
        heightMm: h * 10,
        brand,
        bgColor,
        textColor,
        fontScale,
        frame,
        chalk,
      })
      setPdf(blob)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const wNum = Math.max(2, Math.min(20, Number(widthCm) || 10))
  const hNum = Math.max(2, Math.min(28, Number(heightCm) || 6))

  return (
    <>
      <PageHeader
        title="Étiquettes"
        subtitle="Compose ton modèle (couleurs, logo), choisis des produits, et génère une planche A4 à imprimer et découper."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Modèle + aperçu */}
        <Card>
          <CardContent>
            <Typography variant="h2" gutterBottom>
              Modèle
            </Typography>

            {/* Modèles enregistrés */}
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
              {templates.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Aucun modèle enregistré.
                </Typography>
              ) : (
                templates.map((t) => (
                  <Chip
                    key={t.id}
                    label={t.name}
                    size="small"
                    onClick={() => applyTemplate(t)}
                    onDelete={() => deleteTemplate(t.id)}
                  />
                ))
              )}
            </Stack>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mb: 2 }}>
              <TextField
                size="small"
                label="Nom du modèle"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={saveTemplate}
                disabled={!tplName.trim()}
              >
                Enregistrer
              </Button>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            {/* Aperçu live de l'étiquette */}
            <Box
              sx={{
                aspectRatio: `${wNum} / ${hNum}`,
                bgcolor: bgColor,
                color: textColor,
                border: '1px dashed',
                borderColor: textColor,
                borderRadius: 1,
                p: 0.5,
                mb: 2,
                maxWidth: 360,
                mx: 'auto',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  p: frame === 'wood' ? 1.25 : 1,
                  border: frame === 'wood' ? '5px solid #6b4423' : 'none',
                  outline: frame === 'wood' ? '1px solid #caa06a' : 'none',
                  outlineOffset: frame === 'wood' ? '-6px' : 0,
                }}
              >
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                  <Box sx={{ textAlign: 'center', minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontFamily: chalk ? CHALK_CSS : undefined,
                        fontWeight: chalk ? 400 : 800,
                        textTransform: 'uppercase',
                        lineHeight: 1.15,
                        fontSize: `${(1.05 * fontScale).toFixed(2)}rem`,
                      }}
                    >
                      {previewName}
                    </Typography>
                    {previewNote && (
                      <Typography
                        sx={{
                          fontFamily: chalk ? CHALK_CSS : undefined,
                          mt: 0.5,
                          fontSize: `${(0.62 * fontScale).toFixed(2)}rem`,
                          opacity: 0.85,
                        }}
                      >
                        {previewNote}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ borderTop: '1px solid', borderColor: textColor, opacity: 0.25, my: 0.75 }} />
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    {logoSrc && (
                      <Box component="img" src={logoSrc} alt="" sx={{ height: 16, maxWidth: 56, objectFit: 'contain' }} />
                    )}
                    <Typography sx={{ fontSize: '0.6rem', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, opacity: 0.7 }} noWrap>
                      {brand || 'Marque'}
                    </Typography>
                  </Stack>
                  {showPrice && (
                    <Typography sx={{ fontWeight: 700, fontSize: `${(1 * fontScale).toFixed(2)}rem` }}>1,80 €</Typography>
                  )}
                </Stack>
              </Box>
            </Box>

            <Stack spacing={2}>
              <TextField
                label="Nom affiché (marque)"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex. Maison Alexandre"
              />

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Style de fond
                </Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {THEMES.map((t) => (
                    <Chip
                      key={t.label}
                      label={t.label}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setBgColor(t.bg)
                        setTextColor(t.text)
                        setFrame(t.frame)
                        setChalk(t.chalk)
                      }}
                    />
                  ))}
                </Stack>
                <Stack direction="row" sx={{ mt: 0.5, gap: 2, flexWrap: 'wrap' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={frame === 'wood'}
                        onChange={(e) => setFrame(e.target.checked ? 'wood' : 'none')}
                      />
                    }
                    label="Cadre bois"
                  />
                  <FormControlLabel
                    control={<Switch size="small" checked={chalk} onChange={(e) => setChalk(e.target.checked)} />}
                    label="Police craie"
                  />
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Couleurs
                </Typography>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <TextField
                    type="color"
                    size="small"
                    label="Fond"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 90 }}
                  />
                  <TextField
                    type="color"
                    size="small"
                    label="Texte"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 90 }}
                  />
                </Stack>
                <Stack direction="row" sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  {COLOR_PRESETS.map((c) => (
                    <Chip
                      key={c.label}
                      label={c.label}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setBgColor(c.bg)
                        setTextColor(c.text)
                      }}
                    />
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Taille de l'étiquette (cm)
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <TextField
                    type="number"
                    size="small"
                    label="Largeur"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                    sx={{ width: 110 }}
                  />
                  <Typography color="text.secondary">×</Typography>
                  <TextField
                    type="number"
                    size="small"
                    label="Hauteur"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    sx={{ width: 110 }}
                  />
                </Stack>
                <Stack direction="row" sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  {SIZE_PRESETS.map((p) => (
                    <Chip
                      key={p.label}
                      label={p.label}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setWidthCm(String(p.w))
                        setHeightCm(String(p.h))
                      }}
                    />
                  ))}
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Taille du texte (× {fontScale.toFixed(2)})
                </Typography>
                <Slider
                  value={fontScale}
                  onChange={(_, v) => setFontScale(v as number)}
                  min={0.6}
                  max={1.6}
                  step={0.05}
                  size="small"
                  sx={{ maxWidth: 280 }}
                />
              </Box>

              <TextField
                label="Texte libre (allergènes, promo…)"
                value={extraText}
                onChange={(e) => setExtraText(e.target.value)}
                placeholder="Ex. Contient : gluten, fruits à coque"
                multiline
                minRows={1}
                maxRows={4}
              />
              <FormControlLabel
                control={<Switch checked={useDescription} onChange={(e) => setUseDescription(e.target.checked)} />}
                label="Reprendre la description du produit (ingrédients)"
              />

              <FormControlLabel
                control={<Switch checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />}
                label="Afficher le prix"
              />
              <Typography variant="caption" color="text.secondary">
                Le logo (en bas) provient des réglages de facturation. Fond blanc = impression A4 standard.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Sélection des produits */}
        <Card>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h2">Produits</Typography>
              <Typography variant="caption" color="text.secondary">
                {total} étiquette{total > 1 ? 's' : ''} · {Object.keys(sel).length} produit
                {Object.keys(sel).length > 1 ? 's' : ''}
              </Typography>
            </Stack>
            <TextField
              size="small"
              placeholder="Rechercher un produit…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ my: 1.5 }}
            />
            <Box sx={{ maxHeight: 420, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {filtered.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 2 }}>
                  Aucun produit.
                </Typography>
              ) : (
                filtered.map((a) => {
                  const selected = a.id in sel
                  return (
                    <Stack
                      key={a.id}
                      direction="row"
                      sx={{ alignItems: 'center', gap: 1, px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <Checkbox size="small" checked={selected} onChange={() => toggle(a.id)} sx={{ p: 0.5 }} />
                      <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggle(a.id)}>
                        <Typography variant="body2" noWrap>
                          {a.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {a.code}
                          {a.salePriceTtc != null ? ` · ${eur(a.salePriceTtc)}` : ''}
                        </Typography>
                      </Box>
                      {selected && (
                        <TextField
                          type="number"
                          size="small"
                          label="Qté"
                          value={sel[a.id]}
                          onChange={(e) => setQty(a.id, Number(e.target.value))}
                          sx={{ width: 76 }}
                        />
                      )}
                    </Stack>
                  )
                })
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Button
        variant="contained"
        size="large"
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />}
        disabled={busy || total === 0 || !brand.trim()}
        onClick={() => void generate()}
      >
        Générer le PDF ({total} étiquette{total > 1 ? 's' : ''})
      </Button>

      <PdfViewerModal
        open={pdf != null}
        onClose={() => setPdf(null)}
        blob={pdf}
        filename="etiquettes.pdf"
        title="Étiquettes à imprimer"
      />
    </>
  )
}
