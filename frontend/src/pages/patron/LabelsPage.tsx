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
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import StyleIcon from '@mui/icons-material/Style'
import StarIcon from '@mui/icons-material/Star'
import { errorMessage } from '../../api/client'
import { listArticles } from '../../api/costing'
import { listMyEtablissements } from '../../api/daily'
import { getProfile, logoUrl } from '../../api/billing'
import { listLabelTemplates, type LabelTemplate } from '../../api/labels'
import type { Article } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { PdfViewerModal } from '../../components/PdfViewerModal'
import { LabelPreview, labelLineBreaks } from '../../components/LabelPreview'
import { buildLabelsPdfBlob } from '../../pdf/buildLabelsPdf'
import type { LabelGroup, LabelItem } from '../../pdf/LabelsPdf'

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
 * Impression d'étiquettes : on sélectionne les PRODUITS, chacun sort avec SON modèle (celui
 * réglé sur sa fiche article), sinon avec le « modèle par défaut de l'enseigne ». Le PDF regroupe
 * les produits par modèle (chaque modèle a sa taille → sa planche). Les modèles se composent dans
 * « Modèles d'étiquette ».
 */
export function LabelsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [templates, setTemplates] = useState<LabelTemplate[]>([])
  const [search, setSearch] = useState('')
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
      .then(setTemplates)
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

  // Modèle par défaut de l'enseigne : repli pour les produits sans modèle propre.
  const defaultTemplate = useMemo(() => templates.find((t) => t.enseigneDefault) ?? null, [templates])

  // Le modèle effectif d'un produit : le sien, sinon le défaut enseigne (peut être null).
  const resolveTemplate = (a: Article): LabelTemplate | null =>
    templates.find((t) => t.id === a.labelTemplateId) ?? defaultTemplate

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q))
  }, [articles, search])

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

  // Sélectionne d'un coup tous les produits filtrés (qté 1).
  const selectAll = () =>
    setSel((prev) => {
      const next = { ...prev }
      filtered.forEach((a) => {
        if (!(a.id in next)) next[a.id] = 1
      })
      return next
    })
  const clearSel = () => setSel({})

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

  // Produit d'exemple pour l'aperçu (le 1er sélectionné, sinon le 1er de la liste).
  const sampleArticle = useMemo(() => {
    const firstSel = articles.find((a) => a.id in sel)
    return firstSel ?? filtered[0] ?? null
  }, [articles, sel, filtered])

  // Modèle prévisualisé : celui du produit d'exemple (ou le défaut enseigne, ou le 1er modèle).
  const previewTemplate = useMemo(
    () => (sampleArticle ? resolveTemplate(sampleArticle) : null) ?? defaultTemplate ?? templates[0] ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sampleArticle, defaultTemplate, templates],
  )

  const previewNote = useMemo(() => {
    if (!previewTemplate) return null
    const parts: string[] = []
    if (previewTemplate.useDescription) parts.push(sampleArticle?.description || 'Ingrédients du produit…')
    if (previewTemplate.extraText?.trim()) parts.push(previewTemplate.extraText.trim())
    return parts.length ? parts.join(' · ') : null
  }, [previewTemplate, sampleArticle])

  const templateById = (id: number | null) => templates.find((t) => t.id === id) ?? null

  // Transforme un modèle + ses étiquettes en groupe de planches pour le PDF.
  const toGroup = (t: LabelTemplate, items: LabelItem[]): LabelGroup => ({
    items,
    widthMm: t.widthCm * 10,
    heightMm: t.heightCm * 10,
    brand: t.brand || etabName || 'Marque',
    bgColor: t.bgColor,
    textColor: t.textColor,
    borderColor: t.borderColor,
    fill: t.fillSheet,
    fontScale: t.fontScale,
    frame: t.frame,
    chalk: t.chalk,
    badgePos: t.badgePos,
    bandPos: t.bandPos,
    badgeScale: t.badgeScale,
  })

  const generate = async () => {
    setError(null)
    setNotice(null)
    if (templates.length === 0) {
      setError('Crée d’abord un modèle d’étiquette dans « Modèles d’étiquette ».')
      return
    }
    setBusy(true)
    try {
      // On regroupe les étiquettes par modèle (id → { modèle, items }).
      const groups = new Map<number, { template: LabelTemplate; items: LabelItem[] }>()
      const push = (t: LabelTemplate, item: LabelItem) => {
        const g = groups.get(t.id) ?? { template: t, items: [] }
        g.items.push(item)
        groups.set(t.id, g)
      }
      const missing: string[] = []

      for (const a of articles) {
        const qty = sel[a.id]
        if (!qty) continue
        const tpl = resolveTemplate(a)
        if (!tpl) {
          missing.push(a.name)
          continue
        }
        const price = tpl.showPrice ? eur(a.salePriceTtc) : null
        const noteParts: string[] = []
        if (tpl.useDescription && a.description) noteParts.push(a.description)
        if (tpl.extraText?.trim()) noteParts.push(tpl.extraText.trim())
        const note = noteParts.length ? noteParts.join(' · ') : null
        for (let i = 0; i < qty; i++) push(tpl, { name: labelLineBreaks(a.name), price, note, badges: tpl.badges })
      }

      // Étiquettes libres → modèle par défaut enseigne (sinon le 1er modèle).
      if (freeLabels.length > 0) {
        const tpl = defaultTemplate ?? templates[0]
        const extra = tpl.extraText?.trim() || ''
        for (const f of freeLabels) {
          for (let i = 0; i < f.qty; i++)
            push(tpl, { name: labelLineBreaks(f.name), price: f.price || null, note: extra || null, badges: tpl.badges })
        }
      }

      const groupList = [...groups.values()].map((g) => toGroup(g.template, g.items))
      if (groupList.length === 0) {
        setError('Sélectionne au moins un produit ou ajoute une étiquette libre.')
        return
      }

      try {
        setPdf(await buildLabelsPdfBlob({ groups: groupList }))
      } catch (e) {
        // Repli si la police « craie » d'un modèle ne charge pas : on la désactive partout.
        if (groupList.some((g) => g.chalk)) {
          setPdf(await buildLabelsPdfBlob({ groups: groupList.map((g) => ({ ...g, chalk: false })) }))
          setNotice('La police « craie » n’a pas pu se charger : étiquettes générées avec une police standard.')
        } else {
          throw e
        }
      }

      if (missing.length > 0) {
        setNotice(
          `Non imprimés (sans modèle) : ${missing.join(', ')}. Affecte-leur un modèle sur la fiche article, ` +
            'ou définis un « modèle par défaut enseigne » dans « Modèles d’étiquette ».',
        )
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Étiquettes"
        subtitle="Sélectionne les produits : chacun s'imprime avec son propre modèle (celui de sa fiche), ou le modèle par défaut de l'enseigne. Une seule planche A4 par modèle."
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
      {templates.length > 0 && !defaultTemplate && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Aucun « modèle par défaut enseigne » : les produits sans modèle propre ne seront pas imprimés. Définis-en un
          dans « Modèles d’étiquette » (icône ⭐).
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          // Autorise les colonnes 1fr à rétrécir sous le min-content de leur contenu
          // (sinon la grille déborde horizontalement sur mobile / iPhone).
          '& > *': { minWidth: 0 },
        }}
      >
        {/* Aperçu du modèle du produit d'exemple */}
        <Card>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h2">Aperçu</Typography>
              <Button component={RouterLink} to="/etiquettes/modeles" size="small" startIcon={<StyleIcon />}>
                Gérer les modèles
              </Button>
            </Stack>

            {previewTemplate ? (
              <>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={`Modèle : ${previewTemplate.name}`}
                    size="small"
                    icon={previewTemplate.enseigneDefault ? <StarIcon /> : undefined}
                    color={previewTemplate.enseigneDefault ? 'primary' : 'default'}
                    variant="outlined"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {previewTemplate.widthCm}×{previewTemplate.heightCm} cm
                  </Typography>
                </Stack>
                <LabelPreview
                  style={{
                    brand: previewTemplate.brand || etabName || 'Marque',
                    bgColor: previewTemplate.bgColor,
                    textColor: previewTemplate.textColor,
                    borderColor: previewTemplate.borderColor,
                    widthCm: previewTemplate.widthCm,
                    heightCm: previewTemplate.heightCm,
                    fontScale: previewTemplate.fontScale,
                    showPrice: previewTemplate.showPrice,
                    frame: previewTemplate.frame,
                    chalk: previewTemplate.chalk,
                    badgePos: previewTemplate.badgePos,
                    bandPos: previewTemplate.bandPos,
                    badgeScale: previewTemplate.badgeScale,
                  }}
                  badges={previewTemplate.badges}
                  name={sampleArticle?.name ?? 'Croissant choco noisette'}
                  price={previewTemplate.showPrice ? (eur(sampleArticle?.salePriceTtc ?? null) ?? '1,80 €') : null}
                  note={previewNote}
                  logoSrc={logoSrc}
                />
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Crée un modèle pour voir l’aperçu.
              </Typography>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Chaque produit s’imprime avec le modèle réglé sur sa fiche article. Pour changer le style ou la taille,
              va dans « Modèles d’étiquette ».
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
            </Stack>
            {filtered.length > 0 && (
              <Stack direction="row" sx={{ gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                <Button size="small" onClick={selectAll}>
                  Tout sélectionner ({filtered.length})
                </Button>
                {Object.keys(sel).length > 0 && (
                  <Button size="small" color="inherit" onClick={clearSel}>
                    Tout désélectionner
                  </Button>
                )}
              </Stack>
            )}

            <Box sx={{ maxHeight: 420, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, mt: 1 }}>
              {filtered.length === 0 ? (
                <Typography color="text.secondary" sx={{ p: 2 }}>
                  Aucun produit.
                </Typography>
              ) : (
                filtered.map((a) => {
                  const selected = a.id in sel
                  const own = templateById(a.labelTemplateId)
                  // Étiquette affichée : modèle propre, sinon défaut enseigne, sinon « sans modèle ».
                  const chip = own
                    ? { label: own.name, color: 'default' as const, star: false }
                    : defaultTemplate
                      ? { label: `Défaut : ${defaultTemplate.name}`, color: 'primary' as const, star: true }
                      : { label: 'Sans modèle', color: 'error' as const, star: false }
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
                        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="caption" color="text.secondary">
                            {a.code}
                            {a.salePriceTtc != null ? ` · ${eur(a.salePriceTtc)}` : ''}
                          </Typography>
                          <Chip
                            label={chip.label}
                            size="small"
                            variant="outlined"
                            color={chip.color}
                            icon={chip.star ? <StarIcon /> : undefined}
                            sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-icon': { fontSize: 12 } }}
                          />
                        </Stack>
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
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {defaultTemplate
                ? `Imprimée avec le modèle par défaut enseigne (${defaultTemplate.name}).`
                : 'Imprimée avec le premier modèle disponible.'}
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
        disabled={busy || total === 0 || templates.length === 0}
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
