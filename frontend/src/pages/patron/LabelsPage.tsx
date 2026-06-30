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
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
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

const eur = (v: number | null): string | null =>
  v == null ? null : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

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
  const [showPrice, setShowPrice] = useState(true)
  const [logoSrc, setLogoSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      for (const a of articles) {
        const qty = sel[a.id]
        if (!qty) continue
        const price = showPrice ? eur(a.salePriceTtc) : null
        for (let i = 0; i < qty; i++) items.push({ name: a.name, price })
      }
      const w = Math.max(2, Math.min(20, Number(widthCm) || 10))
      const h = Math.max(2, Math.min(28, Number(heightCm) || 6))
      const blob = await buildLabelsPdfBlob({ items, widthMm: w * 10, heightMm: h * 10, brand, bgColor, textColor })
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

            {/* Aperçu live de l'étiquette */}
            <Box
              sx={{
                aspectRatio: `${wNum} / ${hNum}`,
                bgcolor: bgColor,
                color: textColor,
                border: '1px dashed',
                borderColor: textColor,
                borderRadius: 1,
                p: 1.5,
                mb: 2,
                display: 'flex',
                flexDirection: 'column',
                maxWidth: 360,
                mx: 'auto',
              }}
            >
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                <Typography
                  sx={{ fontWeight: 800, textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.15, fontSize: '1.05rem' }}
                >
                  {previewName}
                </Typography>
              </Box>
              <Box sx={{ borderTop: '1px solid', borderColor: textColor, opacity: 0.25, my: 0.75 }} />
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-end', opacity: 1 }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  {logoSrc && (
                    <Box component="img" src={logoSrc} alt="" sx={{ height: 16, maxWidth: 56, objectFit: 'contain' }} />
                  )}
                  <Typography sx={{ fontSize: '0.6rem', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, opacity: 0.7 }} noWrap>
                    {brand || 'Marque'}
                  </Typography>
                </Stack>
                {showPrice && <Typography sx={{ fontWeight: 700 }}>1,80 €</Typography>}
              </Stack>
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
