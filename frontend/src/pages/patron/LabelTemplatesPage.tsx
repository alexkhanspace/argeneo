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
  IconButton,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import AddIcon from '@mui/icons-material/Add'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { errorMessage } from '../../api/client'
import { getProfile, getSettings, logoUrl } from '../../api/billing'
import { listMyEtablissements } from '../../api/daily'
import { listArticles } from '../../api/costing'
import type { Article } from '../../api/types'
import {
  assignArticlesToTemplate,
  createLabelTemplate,
  deleteLabelTemplate,
  listLabelTemplates,
  toggleDefaultLabelTemplate,
  updateLabelTemplate,
  type LabelBadge,
  type LabelTemplate,
  type LabelTemplateInput,
} from '../../api/labels'
import { PageHeader } from '../../components/PageHeader'
import { LabelPreview } from '../../components/LabelPreview'

const SIZE_PRESETS = [
  { label: '10 × 6', w: 10, h: 6 },
  { label: '6 × 10', w: 6, h: 10 },
  { label: '8 × 5', w: 8, h: 5 },
  { label: '5 × 3', w: 5, h: 3 },
]
const COLOR_PRESETS = [
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
const BADGE_PRESETS: { label: string; color: string }[] = [
  { label: 'Kasher', color: '#7b1fa2' },
  { label: 'Halal', color: '#7b1fa2' },
  { label: 'Vegan', color: '#2e7d32' },
  { label: 'Bio', color: '#66bb6a' },
  { label: 'Sans gluten', color: '#8d6e63' },
  { label: 'Fait maison', color: '#5d4037' },
]

/** Un badge en cours d'édition (id local pour la liste React). */
interface EditBadge extends LabelBadge {
  id: string
}

const DEFAULTS = {
  name: '',
  brand: '',
  bgColor: '#ffffff',
  textColor: '#111111',
  borderColor: '#111111',
  widthCm: '10',
  heightCm: '6',
  fontScale: 1,
  showPrice: true,
  frame: 'none' as Frame,
  chalk: false,
  fillSheet: false,
  badgePos: 'tr' as 'tr' | 'tl' | 'footer',
  badgeScale: 1,
  extraText: '',
  useDescription: false,
}

/**
 * Éditeur des modèles d'étiquette : on compose un modèle (style + badges), on l'enregistre,
 * puis on l'affecte aux produits dans la fiche article. L'impression est un autre écran.
 */
export function LabelTemplatesPage() {
  const [templates, setTemplates] = useState<LabelTemplate[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)

  const [name, setName] = useState(DEFAULTS.name)
  const [brand, setBrand] = useState(DEFAULTS.brand)
  const [bgColor, setBgColor] = useState(DEFAULTS.bgColor)
  const [textColor, setTextColor] = useState(DEFAULTS.textColor)
  const [borderColor, setBorderColor] = useState(DEFAULTS.borderColor)
  const [widthCm, setWidthCm] = useState(DEFAULTS.widthCm)
  const [heightCm, setHeightCm] = useState(DEFAULTS.heightCm)
  const [fontScale, setFontScale] = useState(DEFAULTS.fontScale)
  const [showPrice, setShowPrice] = useState(DEFAULTS.showPrice)
  const [frame, setFrame] = useState<Frame>(DEFAULTS.frame)
  const [chalk, setChalk] = useState(DEFAULTS.chalk)
  const [fillSheet, setFillSheet] = useState(DEFAULTS.fillSheet)
  const [badgePos, setBadgePos] = useState<'tr' | 'tl' | 'footer'>(DEFAULTS.badgePos)
  const [badgeScale, setBadgeScale] = useState(DEFAULTS.badgeScale)
  const [extraText, setExtraText] = useState(DEFAULTS.extraText)
  const [useDescription, setUseDescription] = useState(DEFAULTS.useDescription)
  const [badges, setBadges] = useState<EditBadge[]>([])
  const [badgeInput, setBadgeInput] = useState('')
  const [badgeInputColor, setBadgeInputColor] = useState('#37474f')

  const [logoSrc, setLogoSrc] = useState<string | null>(null)
  const [brandColors, setBrandColors] = useState<{ c1: string; c2: string }>({ c1: '#c2410c', c2: '#c2410c' })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Affectation de produits au modèle en cours d'édition.
  const [articles, setArticles] = useState<Article[]>([])
  const [assignSearch, setAssignSearch] = useState('')
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignSel, setAssignSel] = useState<Set<number>>(new Set())

  const refresh = () => {
    listLabelTemplates()
      .then(setTemplates)
      .catch((e) => setError(errorMessage(e)))
  }
  const refreshArticles = () => {
    listArticles()
      .then((list) => setArticles(list.filter((a) => a.active)))
      .catch(() => undefined)
  }

  useEffect(() => {
    refresh()
    refreshArticles()
    listMyEtablissements()
      .then((list) => {
        if (list.length > 0) setBrand((b) => b || list[0].name)
      })
      .catch(() => undefined)
    getProfile()
      .then((p) => setLogoSrc(p.logoFile ? logoUrl(p.logoFile) : null))
      .catch(() => undefined)
    getSettings()
      .then((s) =>
        setBrandColors({ c1: s.brandColor1 || '#c2410c', c2: s.brandColor2 || s.brandColor1 || '#111111' }),
      )
      .catch(() => undefined)
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setName(DEFAULTS.name)
    setBgColor(DEFAULTS.bgColor)
    setTextColor(DEFAULTS.textColor)
    setBorderColor(DEFAULTS.borderColor)
    setWidthCm(DEFAULTS.widthCm)
    setHeightCm(DEFAULTS.heightCm)
    setFontScale(DEFAULTS.fontScale)
    setShowPrice(DEFAULTS.showPrice)
    setFrame(DEFAULTS.frame)
    setChalk(DEFAULTS.chalk)
    setFillSheet(DEFAULTS.fillSheet)
    setBadgePos(DEFAULTS.badgePos)
    setBadgeScale(DEFAULTS.badgeScale)
    setExtraText(DEFAULTS.extraText)
    setUseDescription(DEFAULTS.useDescription)
    setBadges([])
    setNotice(null)
    setAssignSel(new Set())
  }

  const loadTemplate = (t: LabelTemplate) => {
    setEditingId(t.id)
    setAssignSel(new Set())
    setName(t.name)
    setBrand(t.brand ?? '')
    setBgColor(t.bgColor)
    setTextColor(t.textColor)
    setBorderColor(t.borderColor)
    setWidthCm(String(t.widthCm))
    setHeightCm(String(t.heightCm))
    setFontScale(t.fontScale)
    setShowPrice(t.showPrice)
    setFrame(t.frame)
    setChalk(t.chalk)
    setFillSheet(t.fillSheet)
    setBadgePos(t.badgePos)
    setBadgeScale(t.badgeScale)
    setExtraText(t.extraText ?? '')
    setUseDescription(t.useDescription)
    setBadges(t.badges.map((b, i) => ({ ...b, id: `${i}-${Date.now()}` })))
    setNotice(null)
    setError(null)
  }

  const buildInput = (): LabelTemplateInput => ({
    name: name.trim(),
    brand: brand.trim() || null,
    bgColor,
    textColor,
    borderColor,
    widthCm: Math.max(2, Math.min(20, Number(widthCm) || 10)),
    heightCm: Math.max(2, Math.min(28, Number(heightCm) || 6)),
    fontScale,
    showPrice,
    frame,
    chalk,
    fillSheet,
    badgePos,
    badgeScale,
    extraText: extraText.trim() || null,
    useDescription,
    badges: badges.map(({ text, color, img }) => ({ text: text ?? null, color: color ?? null, img: img ?? null })),
  })

  const save = async () => {
    if (!name.trim()) return
    setError(null)
    setBusy(true)
    try {
      const input = buildInput()
      const saved = editingId ? await updateLabelTemplate(editingId, input) : await createLabelTemplate(input)
      setEditingId(saved.id)
      setNotice(`Modèle « ${saved.name} » enregistré.`)
      refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (t: LabelTemplate) => {
    if (!window.confirm(`Supprimer le modèle « ${t.name} » ? Les articles concernés seront détachés.`)) return
    try {
      await deleteLabelTemplate(t.id)
      if (editingId === t.id) resetForm()
      refresh()
      refreshArticles()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  // Bascule le « modèle par défaut de l'enseigne » (au plus un).
  const toggleDefault = async (t: LabelTemplate) => {
    setError(null)
    try {
      setTemplates(await toggleDefaultLabelTemplate(t.id))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  // --- Affectation de produits au modèle en cours d'édition ---
  const toggleAssign = (id: number) =>
    setAssignSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const assignFiltered = useMemo(() => {
    const q = assignSearch.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q))
  }, [articles, assignSearch])

  const applyAssign = async () => {
    if (editingId == null || assignSel.size === 0) return
    setAssignBusy(true)
    setError(null)
    try {
      await assignArticlesToTemplate(editingId, [...assignSel])
      setNotice(`${assignSel.size} produit${assignSel.size > 1 ? 's' : ''} affecté${assignSel.size > 1 ? 's' : ''} à ce modèle.`)
      setAssignSel(new Set())
      refreshArticles()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setAssignBusy(false)
    }
  }

  // --- Badges du modèle ---
  const togglePreset = (p: { label: string; color: string }) =>
    setBadges((list) =>
      list.some((b) => b.text === p.label)
        ? list.filter((b) => b.text !== p.label)
        : [...list, { id: `${Date.now()}-${p.label}`, text: p.label, color: p.color }],
    )
  const addCustomBadge = () => {
    const t = badgeInput.trim()
    if (!t) return
    setBadges((list) => [...list, { id: `${Date.now()}`, text: t, color: badgeInputColor }])
    setBadgeInput('')
  }
  const addImageBadge = (img: string) => setBadges((list) => [...list, { id: `${Date.now()}`, img }])
  const removeBadge = (id: string) => setBadges((list) => list.filter((b) => b.id !== id))

  const wNum = Math.max(2, Math.min(20, Number(widthCm) || 10))
  const hNum = Math.max(2, Math.min(28, Number(heightCm) || 6))
  const anyBadge = badges.some((b) => b.img || b.text?.trim())

  const previewNote = useMemo(() => {
    const parts: string[] = []
    if (useDescription) parts.push('Ingrédients du produit…')
    if (extraText.trim()) parts.push(extraText.trim())
    return parts.length ? parts.join(' · ') : null
  }, [useDescription, extraText])

  return (
    <>
      <PageHeader
        title="Modèles d'étiquette"
        subtitle="Compose un modèle (style + badges), enregistre-le, puis affecte-le à tes produits dans la fiche article. L'impression se fait depuis « Étiquettes »."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Éditeur du modèle */}
        <Card>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h2">{editingId ? 'Modifier le modèle' : 'Nouveau modèle'}</Typography>
              {editingId && (
                <Button size="small" startIcon={<AddIcon />} onClick={resetForm}>
                  Nouveau
                </Button>
              )}
            </Stack>

            <LabelPreview
              style={{
                brand,
                bgColor,
                textColor,
                borderColor,
                widthCm: wNum,
                heightCm: hNum,
                fontScale,
                showPrice,
                frame,
                chalk,
                badgePos,
                badgeScale,
              }}
              badges={badges}
              name="Croissant choco noisette"
              price="1,80 €"
              note={previewNote}
              logoSrc={logoSrc}
            />

            <Stack spacing={2}>
              <TextField
                label="Nom du modèle"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Ardoise Kasher, Ardoise Vegan Halal…"
                required
              />
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
                    control={<Switch size="small" checked={fillSheet} onChange={(e) => setFillSheet(e.target.checked)} />}
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
                    variant="outlined"
                    sx={{ borderColor: brandColors.c1, color: brandColors.c1, fontWeight: 600 }}
                    onClick={() => {
                      setBgColor('#ffffff')
                      setTextColor(brandColors.c1)
                      setBorderColor(brandColors.c2)
                    }}
                  />
                </Stack>
              </Box>

              {/* Badges du modèle */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Badges du modèle — appliqués à tous les articles portant ce modèle (Kasher, Vegan…)
                </Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  {BADGE_PRESETS.map((p) => {
                    const on = badges.some((b) => b.text === p.label)
                    return (
                      <Chip
                        key={p.label}
                        label={p.label}
                        size="small"
                        onClick={() => togglePreset(p)}
                        sx={{
                          border: '1px solid',
                          borderColor: p.color,
                          bgcolor: on ? p.color : 'transparent',
                          color: on ? '#fff' : p.color,
                          fontWeight: 600,
                          '&:hover': { bgcolor: on ? p.color : 'transparent' },
                        }}
                      />
                    )
                  })}
                </Stack>
                <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    label="Badge perso"
                    value={badgeInput}
                    onChange={(e) => setBadgeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addCustomBadge()
                    }}
                    placeholder="ex. Médaille d'or"
                    sx={{ flex: 1, minWidth: 120 }}
                  />
                  <TextField
                    type="color"
                    size="small"
                    label="Couleur"
                    value={badgeInputColor}
                    onChange={(e) => setBadgeInputColor(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 80 }}
                  />
                  <Button variant="outlined" size="small" onClick={addCustomBadge} disabled={!badgeInput.trim()}>
                    Ajouter
                  </Button>
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
                        r.onloadend = () => addImageBadge(r.result as string)
                        r.readAsDataURL(f)
                      }}
                    />
                  </Button>
                </Stack>
                {badges.length > 0 && (
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                    {badges.map((b) => (
                      <Chip
                        key={b.id}
                        label={b.img ? 'Image' : b.text}
                        size="small"
                        onDelete={() => removeBadge(b.id)}
                        sx={
                          b.img
                            ? undefined
                            : {
                                bgcolor: b.color ?? undefined,
                                color: '#fff',
                                fontWeight: 600,
                                '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.85)' },
                              }
                        }
                      />
                    ))}
                  </Stack>
                )}
                {anyBadge && (
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={badgePos}
                    onChange={(_: unknown, v: 'tr' | 'tl' | 'footer' | null) => v && setBadgePos(v)}
                    sx={{ mt: 1.5 }}
                  >
                    <ToggleButton value="tl">Haut gauche</ToggleButton>
                    <ToggleButton value="tr">Haut droite</ToggleButton>
                    <ToggleButton value="footer">Près du prix</ToggleButton>
                  </ToggleButtonGroup>
                )}
                {anyBadge && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Taille des badges (× {badgeScale.toFixed(2)})
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

              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={() => void save()}
                disabled={busy || !name.trim()}
              >
                {editingId ? 'Enregistrer les modifications' : 'Créer le modèle'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          {/* Modèles enregistrés */}
          <Card>
            <CardContent>
              <Typography variant="h2" gutterBottom>
                Mes modèles
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                L’étoile ⭐ désigne le <strong>modèle par défaut de l’enseigne</strong> : il s’applique aux produits
                sans modèle propre lors de l’impression.
              </Typography>
              {templates.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Aucun modèle. Compose-en un à gauche et enregistre-le.
                </Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {templates.map((t) => (
                    <Stack key={t.id} direction="row" spacing={1} sx={{ py: 1, alignItems: 'center' }}>
                      <Tooltip title={t.enseigneDefault ? 'Modèle par défaut enseigne (cliquer pour retirer)' : 'Définir comme modèle par défaut enseigne'}>
                        <IconButton
                          size="small"
                          color={t.enseigneDefault ? 'primary' : 'default'}
                          onClick={() => void toggleDefault(t)}
                        >
                          {t.enseigneDefault ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Box
                        sx={{
                          width: 44,
                          height: 28,
                          flexShrink: 0,
                          borderRadius: 0.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: t.bgColor,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: editingId === t.id ? 700 : 500 }}>
                          {t.name}
                          {t.enseigneDefault ? ' · défaut enseigne' : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t.widthCm}×{t.heightCm} cm
                          {t.badges.length > 0 ? ` · ${t.badges.length} badge${t.badges.length > 1 ? 's' : ''}` : ''}
                        </Typography>
                      </Box>
                      <Button size="small" onClick={() => loadTemplate(t)}>
                        Éditer
                      </Button>
                      <Button size="small" color="error" onClick={() => void remove(t)}>
                        Supprimer
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          {/* Affectation de produits au modèle en cours d'édition */}
          {editingId != null && (
            <Card>
              <CardContent>
                <Typography variant="h2" gutterBottom>
                  Affecter des produits à « {name || 'ce modèle'} »
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Coche les produits à imprimer avec ce modèle : ils prendront ce modèle par défaut (comme sur leur
                  fiche article).
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Rechercher un produit…"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  {assignFiltered.length === 0 ? (
                    <Typography color="text.secondary" sx={{ p: 2 }}>
                      Aucun produit.
                    </Typography>
                  ) : (
                    assignFiltered.map((a) => {
                      const onThis = a.labelTemplateId === editingId
                      const otherName = templates.find((t) => t.id === a.labelTemplateId)?.name
                      return (
                        <Stack
                          key={a.id}
                          direction="row"
                          sx={{ alignItems: 'center', gap: 1, px: 1, py: 0.25, borderBottom: '1px solid', borderColor: 'divider' }}
                        >
                          <Checkbox
                            size="small"
                            checked={assignSel.has(a.id)}
                            onChange={() => toggleAssign(a.id)}
                            sx={{ p: 0.5 }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggleAssign(a.id)}>
                            <Typography variant="body2" noWrap>
                              {a.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {a.code}
                              {onThis ? ' · déjà sur ce modèle' : otherName ? ` · modèle : ${otherName}` : ' · sans modèle'}
                            </Typography>
                          </Box>
                          {onThis && <Chip label="✓" size="small" color="primary" variant="outlined" sx={{ height: 20 }} />}
                        </Stack>
                      )
                    })
                  )}
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  sx={{ mt: 1.5 }}
                  disabled={assignBusy || assignSel.size === 0}
                  startIcon={assignBusy ? <CircularProgress size={14} color="inherit" /> : undefined}
                  onClick={() => void applyAssign()}
                >
                  Affecter {assignSel.size > 0 ? `(${assignSel.size})` : ''}
                </Button>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Box>
    </>
  )
}
