import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
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
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import StyleIcon from '@mui/icons-material/Style'
import { errorMessage } from '../../api/client'
import { listArticles } from '../../api/costing'
import { listMyEtablissements } from '../../api/daily'
import { getProfile, logoUrl } from '../../api/billing'
import { listLabelTemplates, type LabelTemplate } from '../../api/labels'
import type { Article } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { PdfViewerModal } from '../../components/PdfViewerModal'
import { LabelPreview } from '../../components/LabelPreview'
import { buildLabelsPdfBlob } from '../../pdf/buildLabelsPdf'
import type { LabelItem } from '../../pdf/LabelsPdf'

const eur = (v: number | null): string | null =>
  v == null ? null : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

/** Met en forme un prix saisi librement : « 1,80 » → « 1,80 € », « Promo » → tel quel. */
const fmtFreePrice = (s: string): string | null => {
  const t = s.trim()
  if (!t) return null
  const num = Number(t.replace(',', '.'))
  return /^\d/.test(t) && Number.isFinite(num) ? (eur(num) ?? t) : t
}

/** Étiquette saisie à la main (sans produit du catalogue). */
interface FreeLabel {
  id: string
  name: string
  price: string | null
  qty: number
}

/**
 * Impression d'étiquettes : on choisit un modèle (style + badges), les produits qui le portent
 * héritent de sa mise en forme, et on génère une planche A4 à découper. Les modèles se créent
 * dans « Modèles d'étiquette ».
 */
export function LabelsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [templates, setTemplates] = useState<LabelTemplate[]>([])
  const [templateId, setTemplateId] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const [onlyThisModel, setOnlyThisModel] = useState(true)
  // id article → quantité (présence = sélectionné).
  const [sel, setSel] = useState<Record<number, number>>({})
  const [logoSrc, setLogoSrc] = useState<string | null>(null)
  const [etabName, setEtabName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Étiquettes libres (sans produit) + champs de saisie.
  const [freeLabels, setFreeLabels] = useState<FreeLabel[]>([])
  const [fName, setFName] = useState('')
  const [fPrice, setFPrice] = useState('')
  const [fQty, setFQty] = useState('1')
  const [editId, setEditId] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const [pdf, setPdf] = useState<Blob | null>(null)

  useEffect(() => {
    listArticles()
      .then((list) => setArticles(list.filter((a) => a.active)))
      .catch((e) => setError(errorMessage(e)))
    listLabelTemplates()
      .then((list) => {
        setTemplates(list)
        if (list.length > 0) setTemplateId((id) => (id === '' ? list[0].id : id))
      })
      .catch((e) => setError(errorMessage(e)))
    listMyEtablissements()
      .then((list) => {
        if (list.length > 0) setEtabName(list[0].name)
      })
      .catch(() => undefined)
    getProfile()
      .then((p) => setLogoSrc(p.logoFile ? logoUrl(p.logoFile) : null))
      .catch(() => undefined)
  }, [])

  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return articles.filter((a) => {
      if (onlyThisModel && templateId !== '' && a.labelTemplateId !== templateId) return false
      if (!q) return true
      return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q)
    })
  }, [articles, search, onlyThisModel, templateId])

  const total = useMemo(
    () => Object.values(sel).reduce((s, n) => s + n, 0) + freeLabels.reduce((s, f) => s + f.qty, 0),
    [sel, freeLabels],
  )

  const toggle = (id: number) =>
    setSel((prev) => {
      const next = { ...prev }
      if (id in next) delete next[id]
      else next[id] = 1
      return next
    })
  const setQty = (id: number, n: number) =>
    setSel((prev) => ({ ...prev, [id]: Math.max(1, Math.min(999, Math.round(n) || 1)) }))

  // Sélectionne d'un coup tous les articles du modèle courant (qté 1).
  const selectAllOfModel = () =>
    setSel((prev) => {
      const next = { ...prev }
      filtered.forEach((a) => {
        if (!(a.id in next)) next[a.id] = 1
      })
      return next
    })

  // --- Étiquettes libres ---
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

  // Article d'exemple pour l'aperçu (le 1er sélectionné, sinon le 1er de la liste).
  const sampleArticle = useMemo(() => {
    const firstSel = articles.find((a) => a.id in sel)
    return firstSel ?? filtered[0] ?? null
  }, [articles, sel, filtered])

  const previewNote = useMemo(() => {
    if (!template) return null
    const parts: string[] = []
    if (template.useDescription) parts.push(sampleArticle?.description || 'Ingrédients du produit…')
    if (template.extraText?.trim()) parts.push(template.extraText.trim())
    return parts.length ? parts.join(' · ') : null
  }, [template, sampleArticle])

  const generate = async () => {
    setError(null)
    setNotice(null)
    if (!template) {
      setError('Choisis un modèle d’étiquette.')
      return
    }
    setBusy(true)
    try {
      const items: LabelItem[] = []
      const extra = template.extraText?.trim() || ''
      const badges = template.badges
      for (const a of articles) {
        const qty = sel[a.id]
        if (!qty) continue
        const price = template.showPrice ? eur(a.salePriceTtc) : null
        const noteParts: string[] = []
        if (template.useDescription && a.description) noteParts.push(a.description)
        if (extra) noteParts.push(extra)
        const note = noteParts.length ? noteParts.join(' · ') : null
        for (let i = 0; i < qty; i++) items.push({ name: a.name, price, note, badges })
      }
      for (const f of freeLabels) {
        for (let i = 0; i < f.qty; i++)
          items.push({ name: f.name, price: f.price || null, note: extra || null, badges })
      }
      if (items.length === 0) {
        setError('Sélectionne au moins un produit ou ajoute une étiquette libre.')
        return
      }
      const base = {
        items,
        widthMm: template.widthCm * 10,
        heightMm: template.heightCm * 10,
        brand: template.brand || etabName || 'Marque',
        bgColor: template.bgColor,
        textColor: template.textColor,
        borderColor: template.borderColor,
        fill: template.fillSheet,
        fontScale: template.fontScale,
        frame: template.frame,
        badgePos: template.badgePos,
        badgeScale: template.badgeScale,
      }
      try {
        setPdf(await buildLabelsPdfBlob({ ...base, chalk: template.chalk }))
      } catch (e) {
        if (template.chalk) {
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

  const templateName = (id: number | null) => templates.find((t) => t.id === id)?.name ?? null

  return (
    <>
      <PageHeader
        title="Étiquettes"
        subtitle="Choisis un modèle, sélectionne les produits qui le portent, et génère une planche A4 à imprimer et découper."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {templates.length === 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button component={RouterLink} to="/etiquettes/modeles" size="small" startIcon={<StyleIcon />}>
              Créer un modèle
            </Button>
          }
        >
          Aucun modèle d’étiquette. Crée d’abord un modèle (style + badges) pour imprimer.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Modèle + aperçu */}
        <Card>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h2">Modèle</Typography>
              <Button component={RouterLink} to="/etiquettes/modeles" size="small" startIcon={<StyleIcon />}>
                Gérer les modèles
              </Button>
            </Stack>

            <TextField
              select
              fullWidth
              size="small"
              label="Modèle d'étiquette"
              value={templateId === '' ? '' : String(templateId)}
              onChange={(e) => setTemplateId(e.target.value === '' ? '' : Number(e.target.value))}
              sx={{ mb: 2 }}
              disabled={templates.length === 0}
            >
              {templates.map((t) => (
                <MenuItem key={t.id} value={String(t.id)}>
                  {t.name} — {t.widthCm}×{t.heightCm} cm
                  {t.badges.length > 0 ? ` · ${t.badges.length} badge${t.badges.length > 1 ? 's' : ''}` : ''}
                </MenuItem>
              ))}
            </TextField>

            {template ? (
              <LabelPreview
                style={{
                  brand: template.brand || etabName || 'Marque',
                  bgColor: template.bgColor,
                  textColor: template.textColor,
                  borderColor: template.borderColor,
                  widthCm: template.widthCm,
                  heightCm: template.heightCm,
                  fontScale: template.fontScale,
                  showPrice: template.showPrice,
                  frame: template.frame,
                  chalk: template.chalk,
                  badgePos: template.badgePos,
                  badgeScale: template.badgeScale,
                }}
                badges={template.badges}
                name={sampleArticle?.name ?? 'Croissant choco noisette'}
                price={template.showPrice ? (eur(sampleArticle?.salePriceTtc ?? null) ?? '1,80 €') : null}
                note={previewNote}
                logoSrc={logoSrc}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Sélectionne un modèle pour voir l’aperçu.
              </Typography>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Le style, les badges et la taille proviennent du modèle. Pour les modifier, va dans « Modèles d’étiquette ».
            </Typography>
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

            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              <TextField
                size="small"
                placeholder="Rechercher un produit…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ flex: 1, minWidth: 160 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={onlyThisModel}
                    onChange={(e) => setOnlyThisModel(e.target.checked)}
                  />
                }
                label="Seulement ce modèle"
              />
            </Stack>
            {filtered.length > 0 && (
              <Button size="small" onClick={selectAllOfModel} sx={{ mt: 0.5 }}>
                Tout sélectionner ({filtered.length})
              </Button>
            )}

            <Box sx={{ maxHeight: 420, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, mt: 1 }}>
              {filtered.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 2 }}>
                  {onlyThisModel
                    ? 'Aucun produit ne porte ce modèle. Affecte-le depuis la fiche article, ou décoche « Seulement ce modèle ».'
                    : 'Aucun produit.'}
                </Typography>
              ) : (
                filtered.map((a) => {
                  const selected = a.id in sel
                  const own = templateName(a.labelTemplateId)
                  const mismatch = templateId !== '' && a.labelTemplateId !== templateId
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
                        {!onlyThisModel && mismatch && (
                          <Chip
                            label={own ? `Modèle : ${own}` : 'Sans modèle'}
                            size="small"
                            variant="outlined"
                            sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }}
                          />
                        )}
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

            {/* Étiquettes libres */}
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
                multiline
                minRows={1}
                helperText="Entrée = saut de ligne (ex. Bagel ⏎ Saumon)"
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
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 1 }}>
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
            )}
          </CardContent>
        </Card>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Button
        variant="contained"
        size="large"
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />}
        disabled={busy || total === 0 || !template}
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
