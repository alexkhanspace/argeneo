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
  ToggleButton,
  ToggleButtonGroup,
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
// Badges prêts à l'emploi (le patron peut aussi taper un texte libre ou charger une image/médaille).
const BADGE_PRESETS = ['Kasher', 'Halal', 'Vegan', 'Bio', 'Sans gluten', 'Fait maison']

const eur = (v: number | null): string | null =>
  v == null ? null : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

/** Étiquette saisie à la main (sans produit du catalogue). */
interface FreeLabel {
  id: string
  name: string
  price: string | null
  qty: number
}

/** Met en forme un prix saisi librement : « 1,80 » → « 1,80 € », « Promo » → tel quel. */
const fmtFreePrice = (s: string): string | null => {
  const t = s.trim()
  if (!t) return null
  const num = Number(t.replace(',', '.'))
  return /^\d/.test(t) && Number.isFinite(num) ? (eur(num) ?? t) : t
}

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
  borderColor?: string
  fillSheet?: boolean
  badgeText?: string
  badgePos?: 'tr' | 'tl' | 'footer'
  badgeScale?: number
  badgeColor?: string
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
  const [borderColor, setBorderColor] = useState('#111111')
  const [frame, setFrame] = useState<Frame>('none')
  const [chalk, setChalk] = useState(false)
  const [fontScale, setFontScale] = useState(1)
  const [showPrice, setShowPrice] = useState(true)
  // Agrandir les étiquettes pour remplir l'A4 (moins de blanc/perte).
  const [fillSheet, setFillSheet] = useState(false)
  // Badge perso (Kasher, Vegan, Bio, Halal, médaille…) : texte et/ou image.
  const [badgeText, setBadgeText] = useState('')
  const [badgeUrl, setBadgeUrl] = useState<string | null>(null)
  const [badgePos, setBadgePos] = useState<'tr' | 'tl' | 'footer'>('tr')
  // Multiplicateur de taille de l'image du badge (médaille).
  const [badgeScale, setBadgeScale] = useState(1)
  // Couleur du badge texte (texte + contour).
  const [badgeColor, setBadgeColor] = useState('#111111')
  // Texte libre (allergènes, promo…) commun à toutes les étiquettes.
  const [extraText, setExtraText] = useState('')
  // Reprend la description du produit (ingrédients) sur chaque étiquette.
  const [useDescription, setUseDescription] = useState(false)
  const [logoSrc, setLogoSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Étiquettes libres (sans produit) + champs de saisie.
  const [freeLabels, setFreeLabels] = useState<FreeLabel[]>([])
  const [fName, setFName] = useState('')
  const [fPrice, setFPrice] = useState('')
  const [fQty, setFQty] = useState('1')
  // Étiquette libre en cours d'édition (clic sur une puce) ; null = ajout.
  const [editId, setEditId] = useState<string | null>(null)

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
      borderColor,
      fillSheet,
      badgeText,
      badgePos,
      badgeScale,
      badgeColor,
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
    setBorderColor(t.borderColor ?? t.textColor)
    setFillSheet(t.fillSheet ?? false)
    setBadgeText(t.badgeText ?? '')
    setBadgePos(t.badgePos ?? 'tr')
    setBadgeScale(t.badgeScale ?? 1)
    setBadgeColor(t.badgeColor ?? t.textColor)
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

  const total = useMemo(
    () => Object.values(sel).reduce((s, n) => s + n, 0) + freeLabels.reduce((s, f) => s + f.qty, 0),
    [sel, freeLabels],
  )

  // Ajoute (ou met à jour si on édite) une étiquette libre, puis réinitialise le formulaire.
  const submitFree = () => {
    const name = fName.trim()
    if (!name) return
    const qty = Math.max(1, Math.min(999, Math.round(Number(fQty)) || 1))
    const price = fmtFreePrice(fPrice)
    if (editId) {
      setFreeLabels((prev) => prev.map((f) => (f.id === editId ? { ...f, name, price, qty } : f)))
    } else {
      setFreeLabels((prev) => [...prev, { id: `${Date.now()}`, name, price, qty }])
    }
    setFName('')
    setFPrice('')
    setFQty('1')
    setEditId(null)
  }
  // Charge une étiquette libre dans le formulaire pour l'éditer (et la prévisualiser).
  const startEditFree = (f: FreeLabel) => {
    setEditId(f.id)
    setFName(f.name)
    setFPrice(f.price ? f.price.replace(/[^\d.,]/g, '').trim() : '')
    setFQty(String(f.qty))
  }
  const cancelEditFree = () => {
    setEditId(null)
    setFName('')
    setFPrice('')
    setFQty('1')
  }
  const removeFreeLabel = (id: string) => {
    setFreeLabels((prev) => prev.filter((f) => f.id !== id))
    if (editId === id) cancelEditFree()
  }

  // Nom d'aperçu : la saisie libre en cours (édition/ajout) prime, sinon 1er produit, sinon exemple.
  const previewName = useMemo(() => {
    if (fName.trim()) return fName.trim()
    const firstId = articles.find((a) => a.id in sel)?.id
    return (firstId != null && articles.find((a) => a.id === firstId)?.name) || 'Croissant choco noisette'
  }, [fName, articles, sel])

  // Prix d'aperçu : reflète la saisie libre en cours, sinon un prix d'exemple.
  const previewPrice = useMemo(
    () => (fName.trim() ? fmtFreePrice(fPrice) || null : '1,80 €'),
    [fName, fPrice],
  )

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
    setNotice(null)
    setBusy(true)
    try {
      const items: LabelItem[] = []
      const extra = extraText.trim()
      // Étiquettes issues des produits du catalogue.
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
      // Étiquettes libres (saisies à la main, sans produit).
      for (const f of freeLabels) {
        for (let i = 0; i < f.qty; i++) items.push({ name: f.name, price: f.price || null, note: extra || null })
      }
      if (items.length === 0) {
        setError('Sélectionne au moins un produit ou ajoute une étiquette libre.')
        return
      }
      const w = Math.max(2, Math.min(20, Number(widthCm) || 10))
      const h = Math.max(2, Math.min(28, Number(heightCm) || 6))
      const base = {
        items,
        widthMm: w * 10,
        heightMm: h * 10,
        brand,
        bgColor,
        textColor,
        borderColor,
        fill: fillSheet,
        fontScale,
        frame,
        badgeText: badgeText.trim() || null,
        badgeUrl,
        badgePos,
        badgeScale,
        badgeColor,
      }
      try {
        setPdf(await buildLabelsPdfBlob({ ...base, chalk }))
      } catch (e) {
        // La police « craie » est servie en local (public/fonts) : si le rendu échoue malgré tout, on régénère sans.
        if (chalk) {
          setPdf(await buildLabelsPdfBlob({ ...base, chalk: false }))
          setNotice('La police « craie » n’a pas pu se charger : étiquettes générées avec une police standard.')
        } else {
          throw e
        }
      }
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
      {notice && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
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

            {/* Aperçu live de l'étiquette — fidèle au PDF : conteneur CSS + tailles en cqw
                (mêmes ratios que LabelsPdf), et overflow masqué comme le PDF (hauteur fixe). */}
            <Box
              sx={{
                aspectRatio: `${wNum} / ${hNum}`,
                containerType: 'inline-size',
                overflow: 'hidden',
                position: 'relative',
                bgcolor: bgColor,
                color: textColor,
                border: '1px dashed',
                borderColor: borderColor,
                borderRadius: 1,
                p: 0.5,
                mb: 2,
                maxWidth: 360,
                mx: 'auto',
              }}
            >
              {(badgeText.trim() || badgeUrl) && badgePos !== 'footer' && (
                <Box
                  sx={{
                    position: 'absolute',
                    // Écarté de la bordure / du cadre bois pour ne pas être « mangé ».
                    top: frame === 'wood' ? 11 : 5,
                    ...(badgePos === 'tl'
                      ? { left: frame === 'wood' ? 11 : 5 }
                      : { right: frame === 'wood' ? 11 : 5 }),
                    zIndex: 1,
                    display: 'flex',
                  }}
                >
                  {badgeUrl ? (
                    <Box
                      component="img"
                      src={badgeUrl}
                      alt=""
                      style={{ width: `${(22 * badgeScale).toFixed(1)}cqw`, objectFit: 'contain' }}
                    />
                  ) : (
                    <Box
                      sx={{
                        border: '1px solid',
                        borderColor: badgeColor,
                        color: badgeColor,
                        borderRadius: 0.5,
                        px: 0.5,
                        fontWeight: 700,
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3,
                      }}
                      style={{ fontSize: '2.4cqw' }}
                    >
                      {badgeText.trim()}
                    </Box>
                  )}
                </Box>
              )}
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
                      }}
                      style={{ fontSize: `${(7.06 * fontScale).toFixed(2)}cqw` }}
                    >
                      {previewName}
                    </Typography>
                    {previewNote && (
                      <Typography
                        sx={{ fontFamily: chalk ? CHALK_CSS : undefined, mt: 0.5, opacity: 0.85 }}
                        style={{ fontSize: `${(2.96 * fontScale).toFixed(2)}cqw` }}
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
                    <Typography
                      sx={{ letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, opacity: 0.7 }}
                      style={{ fontSize: `${(28.23 / wNum).toFixed(2)}cqw` }}
                      noWrap
                    >
                      {brand || 'Marque'}
                    </Typography>
                  </Stack>
                  {(badgeText.trim() || badgeUrl) && badgePos === 'footer' && (
                    badgeUrl ? (
                      <Box
                        component="img"
                        src={badgeUrl}
                        alt=""
                        style={{ height: `${(12 * badgeScale).toFixed(1)}cqw`, objectFit: 'contain' }}
                      />
                    ) : (
                      <Box
                        sx={{
                          border: '1px solid',
                          borderColor: badgeColor,
                          color: badgeColor,
                          borderRadius: 0.5,
                          px: 0.5,
                          fontWeight: 700,
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          lineHeight: 1.3,
                          alignSelf: 'center',
                        }}
                        style={{ fontSize: '2.2cqw' }}
                      >
                        {badgeText.trim()}
                      </Box>
                    )
                  )}
                  {showPrice && previewPrice && (
                    <Typography sx={{ fontWeight: 700 }} style={{ fontSize: `${(5.64 * fontScale).toFixed(2)}cqw` }}>
                      {previewPrice}
                    </Typography>
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
                  <FormControlLabel
                    control={
                      <Switch size="small" checked={fillSheet} onChange={(e) => setFillSheet(e.target.checked)} />
                    }
                    label="Remplir l'A4 (moins de perte)"
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
                  <TextField
                    type="color"
                    size="small"
                    label="Bordure"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
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
                        setBorderColor(c.text)
                      }}
                    />
                  ))}
                  <Chip
                    label="Enseigne"
                    size="small"
                    color="primary"
                    variant="outlined"
                    onClick={() => {
                      setBgColor('#ffffff')
                      setTextColor('#c2410c')
                      setBorderColor('#c2410c')
                    }}
                  />
                </Stack>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Badge (coin haut-droit) — ex. Kasher, Halal, médaille…
                </Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  {BADGE_PRESETS.map((b) => (
                    <Chip
                      key={b}
                      label={b}
                      size="small"
                      color={badgeText === b ? 'primary' : 'default'}
                      variant={badgeText === b ? 'filled' : 'outlined'}
                      onClick={() => setBadgeText(badgeText === b ? '' : b)}
                    />
                  ))}
                </Stack>
                <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    label="Texte du badge"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    placeholder="ex. Kasher"
                    sx={{ flex: 1, minWidth: 140 }}
                  />
                  <Button component="label" variant="outlined" size="small" sx={{ whiteSpace: 'nowrap' }}>
                    Image / médaille…
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (!f) return
                        const r = new FileReader()
                        r.onloadend = () => setBadgeUrl(r.result as string)
                        r.readAsDataURL(f)
                      }}
                    />
                  </Button>
                  {badgeUrl && <Chip label="Image badge" size="small" onDelete={() => setBadgeUrl(null)} />}
                </Stack>
                {badgeText.trim() && !badgeUrl && (
                  <TextField
                    type="color"
                    size="small"
                    label="Couleur du badge"
                    value={badgeColor}
                    onChange={(e) => setBadgeColor(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 140, mt: 1 }}
                  />
                )}
                {(badgeText.trim() || badgeUrl) && (
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={badgePos}
                    onChange={(_: unknown, v: 'tr' | 'tl' | 'footer' | null) => v && setBadgePos(v)}
                    sx={{ mt: 1 }}
                  >
                    <ToggleButton value="tl">Haut gauche</ToggleButton>
                    <ToggleButton value="tr">Haut droite</ToggleButton>
                    <ToggleButton value="footer">Près du prix</ToggleButton>
                  </ToggleButtonGroup>
                )}
                {badgeUrl && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Taille de l'image (× {badgeScale.toFixed(2)})
                    </Typography>
                    <Slider
                      value={badgeScale}
                      onChange={(_, v) => setBadgeScale(Array.isArray(v) ? v[0] : v)}
                      min={0.4}
                      max={2.5}
                      step={0.1}
                      valueLabelDisplay="auto"
                      size="small"
                      sx={{ maxWidth: 280 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      L'image du badge prime sur le texte.
                    </Typography>
                  </Box>
                )}
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
                  onChange={(_, v) => setFontScale(Array.isArray(v) ? v[0] : v)}
                  min={0.5}
                  max={2}
                  step={0.05}
                  valueLabelDisplay="auto"
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

            {/* Étiquettes libres : saisie manuelle, sans produit du catalogue. */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Étiquette libre (sans produit)
            </Typography>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <TextField
                size="small"
                label="Nom"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitFree()
                }}
                sx={{ flex: 1, minWidth: 140 }}
              />
              <TextField
                size="small"
                label="Prix"
                value={fPrice}
                onChange={(e) => setFPrice(e.target.value)}
                placeholder="ex. 1,80"
                sx={{ width: 90 }}
              />
              <TextField
                type="number"
                size="small"
                label="Qté"
                value={fQty}
                onChange={(e) => setFQty(e.target.value)}
                sx={{ width: 72 }}
              />
              <Button variant="contained" onClick={submitFree} disabled={!fName.trim()} sx={{ mt: 0.25 }}>
                {editId ? 'Modifier' : 'Ajouter'}
              </Button>
              {editId && (
                <Button color="inherit" onClick={cancelEditFree} sx={{ mt: 0.25 }}>
                  Annuler
                </Button>
              )}
            </Stack>
            {freeLabels.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  Clique sur une étiquette pour la prévisualiser et la modifier.
                </Typography>
                <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                  {freeLabels.map((f) => (
                    <Chip
                      key={f.id}
                      label={`${f.name}${f.price ? ` · ${f.price}` : ''} ×${f.qty}`}
                      size="small"
                      color={editId === f.id ? 'primary' : 'default'}
                      variant={editId === f.id ? 'filled' : 'outlined'}
                      onClick={() => startEditFree(f)}
                      onDelete={() => removeFreeLabel(f.id)}
                    />
                  ))}
                </Stack>
              </>
            )}
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
