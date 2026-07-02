import { useEffect, useRef, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import UploadIcon from '@mui/icons-material/Upload'
import DownloadIcon from '@mui/icons-material/Download'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ImageIcon from '@mui/icons-material/Image'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import SaveIcon from '@mui/icons-material/Save'
import DeleteIcon from '@mui/icons-material/Delete'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import { errorMessage } from '../../api/client'
import {
  deleteCommunication,
  generateImageFromPrompt,
  generateSocialPost,
  getCommunication,
  getCommunicationImage,
  listCommunications,
  saveCommunication,
  updateCommunication,
  type CommunicationSummary,
} from '../../api/communication'
import { enhanceImage, getAdSlogans } from '../../api/insights'
import { listArticles, photoUrl } from '../../api/costing'
import { buildPosterPdfBlob } from '../../pdf/buildPosterPdf'
import { getProfile, getSettings, logoUrl } from '../../api/billing'
import { listMyEtablissements } from '../../api/daily'
import type { Article } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'

type Fmt = 'square' | 'story' | 'a4' | 'a5'
// Formats print (A4/A5) en 150 dpi ≈ 1240×1754 / 874×1240 px (ratio √2 respecté).
// `ar` = ratio le plus proche accepté par l'IA (les A4/A5 en √2 ≈ 3:4), donné au générateur d'image
// pour que le visuel épouse le format choisi et ne soit pas rogné.
const FORMATS: Record<Fmt, { w: number; h: number; label: string; ar: string; print?: boolean }> = {
  square: { w: 1080, h: 1080, label: 'Carré', ar: '1:1' },
  story: { w: 1080, h: 1920, label: 'Story', ar: '9:16' },
  a4: { w: 1240, h: 1754, label: 'Affiche A4', ar: '3:4', print: true },
  a5: { w: 874, h: 1240, label: 'Affichette A5', ar: '3:4', print: true },
}

const PLATFORMS = ['Instagram', 'Facebook']
const TONES = ['Chaleureux', 'Fier', 'Festif', 'Informatif', 'Gourmand']
const LENGTHS = [
  { value: 'court', label: 'Courte' },
  { value: 'moyen', label: 'Moyenne' },
  { value: 'long', label: 'Longue' },
]
const AMBIANCES = [
  "Garder le fond d'origine",
  'Fond ardoise élégant',
  'Planche en bois rustique',
  'Fond clair épuré (studio)',
  'Table dressée lifestyle',
  "Fond aux couleurs de l'enseigne",
]

const safeColor = (c: string | null | undefined, fb: string) =>
  c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fb

function imgFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = URL.createObjectURL(blob)
  })
}

/** Charge une image distante en data-URL (évite le taint canvas / service worker). */
function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return fetch(url)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('img'))))
    .then(
      (blob) =>
        new Promise<string>((res, rej) => {
          const fr = new FileReader()
          fr.onloadend = () => res(fr.result as string)
          fr.onerror = rej
          fr.readAsDataURL(blob)
        }),
    )
    .then(
      (dataUrl) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image()
          img.onload = () => res(img)
          img.onerror = rej
          img.src = dataUrl
        }),
    )
    .catch(() => null)
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const r = Math.max(w / img.width, h / img.height)
  const iw = img.width * r
  const ih = img.height * r
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih)
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  yBottom: number,
  maxW: number,
  lineH: number,
): void {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  let y = yBottom - (lines.length - 1) * lineH
  for (const l of lines) {
    ctx.fillText(l, x, y)
    y += lineH
  }
}

export function CommunicationPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [brief, setBrief] = useState('')
  const [platform, setPlatform] = useState('Instagram')
  const [tone, setTone] = useState('Chaleureux')
  const [length, setLength] = useState('moyen')
  const [ambiance, setAmbiance] = useState(AMBIANCES[0])
  const [instruction, setInstruction] = useState('')
  const [headline, setHeadline] = useState('')
  const [format, setFormat] = useState<Fmt>('square')

  // Accroches publicitaires (slogan) proposées pour le produit mis en avant.
  const [slogans, setSlogans] = useState<string[]>([])
  const [sloganLoading, setSloganLoading] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const [caption, setCaption] = useState('')
  const [captionLoading, setCaptionLoading] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [genImg, setGenImg] = useState(false)

  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  const [colors, setColors] = useState({ c1: '#b5651d', c2: '#9a5417' })
  const [etab, setEtab] = useState<{ name?: string; description?: string | null; address?: string | null }>({})
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Produit éventuellement mis en avant + archivage des communications.
  const [articles, setArticles] = useState<Article[]>([])
  const [articleId, setArticleId] = useState<number | ''>('')
  const [archives, setArchives] = useState<CommunicationSummary[]>([])
  const [savedId, setSavedId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const selectedArticle = articles.find((a) => a.id === articleId) ?? null

  const refreshArchives = () => {
    listCommunications().then(setArchives).catch(() => undefined)
  }
  useEffect(() => {
    listArticles().then(setArticles).catch(() => undefined)
    refreshArchives()
  }, [])

  // Arrivée depuis la fiche article (?article=<id>) : pré-sélectionne le produit et son accroche.
  useEffect(() => {
    const aid = searchParams.get('article')
    if (!aid || articles.length === 0) return
    const id = Number(aid)
    const a = articles.find((x) => x.id === id)
    if (a) {
      void onSelectArticle(id)
      void fetchSlogans(a)
    }
    searchParams.delete('article')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles])

  // Chargement initial : charte (couleurs + logo) et contexte établissement.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [settings, profile, etabs] = await Promise.all([
          getSettings().catch(() => null),
          getProfile().catch(() => null),
          listMyEtablissements().catch(() => []),
        ])
        if (cancelled) return
        if (settings) {
          setColors({
            c1: safeColor(settings.brandColor1, '#b5651d'),
            c2: safeColor(settings.brandColor2, safeColor(settings.brandColor1, '#9a5417')),
          })
        }
        const e = etabs[0]
        setEtab({ name: e?.name, description: e?.description, address: e?.address })
        const li = await loadImage(profile?.logoFile ? logoUrl(profile.logoFile) : null)
        if (!cancelled) setLogoImg(li)
      } catch {
        // chargement best-effort
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onGenerateCaption = async () => {
    if (!brief.trim() && !selectedArticle) {
      setError('Décris un sujet ou choisis un produit.')
      return
    }
    setError(null)
    setCaptionLoading(true)
    try {
      const res = await generateSocialPost({
        etablissement: etab.name ?? 'boulangerie',
        description: etab.description ?? null,
        location: etab.address ?? null,
        brief: brief.trim() || null,
        platform,
        tone,
        length,
        articleName: selectedArticle?.name ?? null,
        articleDescription: selectedArticle?.description ?? null,
        priceTtc: selectedArticle?.salePriceTtc ?? null,
      })
      if (!res.enabled) {
        setError(res.caption || 'Génération IA non disponible.')
        return
      }
      setCaption(res.caption)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCaptionLoading(false)
    }
  }

  // Accroches publicitaires (slogan) pour le produit mis en avant.
  const fetchSlogans = async (a: Article) => {
    setSloganLoading(true)
    try {
      const res = await getAdSlogans({
        etablissement: etab.name ?? 'boulangerie',
        description: etab.description ?? null,
        location: etab.address ?? null,
        articleName: a.name,
        articleDescription: a.description,
        priceTtc: a.salePriceTtc,
      })
      const list = res.enabled ? res.slogans : []
      setSlogans(list)
      if (list.length && !headline.trim()) setHeadline(list[0])
    } catch {
      // best-effort : pas d'accroche auto
    } finally {
      setSloganLoading(false)
    }
  }

  // Sélection d'un produit : pré-remplit le contexte et charge sa photo comme base du visuel.
  const onSelectArticle = async (id: number | '') => {
    setArticleId(id)
    setSavedMsg(null)
    if (id === '') {
      setSlogans([])
      return
    }
    const a = articles.find((x) => x.id === id)
    if (a) void fetchSlogans(a)
    if (!a?.photoFile) return
    try {
      const url = photoUrl(a.photoFile)
      if (!url) return
      const res = await fetch(url)
      const blob = await res.blob()
      setSourceFile(new File([blob], 'photo.png', { type: blob.type || 'image/png' }))
      setPhotoImg(await imgFromBlob(blob))
    } catch {
      // pas de photo exploitable : on garde le visuel courant
    }
  }

  const onChangePhoto = async (file: File | undefined) => {
    if (!file) return
    setSourceFile(file)
    setPhotoImg(await imgFromBlob(file))
  }

  /** Rend le canevas courant en blob PNG (le visuel composé à archiver/télécharger). */
  const canvasBlob = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const canvas = canvasRef.current
      if (!canvas) return resolve(null)
      canvas.toBlob((b) => resolve(b), 'image/png')
    })

  const onSave = async () => {
    setError(null)
    setSavedMsg(null)
    setSaving(true)
    try {
      const blob = await canvasBlob()
      const input = {
        brief: brief.trim() || null,
        platform,
        tone,
        length,
        ambiance,
        instruction: instruction.trim() || null,
        headline: headline.trim() || null,
        caption: caption || null,
        articleId: articleId === '' ? null : articleId,
      }
      const saved = savedId
        ? await updateCommunication(savedId, input, blob)
        : await saveCommunication(input, blob)
      setSavedId(saved.id)
      setSavedMsg('Communication enregistrée.')
      refreshArchives()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setSavedId(null)
    setBrief('')
    setCaption('')
    setHeadline('')
    setInstruction('')
    setArticleId('')
    setSourceFile(null)
    setPhotoImg(null)
    setSavedMsg(null)
    setError(null)
  }

  const onOpenArchive = async (id: number) => {
    setError(null)
    try {
      const d = await getCommunication(id)
      setSavedId(d.id)
      setBrief(d.brief ?? '')
      setPlatform(d.platform ?? 'Instagram')
      setTone(d.tone ?? 'Chaleureux')
      setLength(d.length ?? 'moyen')
      setAmbiance(d.ambiance ?? AMBIANCES[0])
      setInstruction(d.instruction ?? '')
      setHeadline(d.headline ?? '')
      setCaption(d.caption ?? '')
      setArticleId(d.articleId ?? '')
      setSavedMsg(null)
      if (d.hasImage) {
        const blob = await getCommunicationImage(d.id)
        setSourceFile(null)
        setPhotoImg(await imgFromBlob(blob))
      } else {
        setPhotoImg(null)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const onDeleteArchive = async (id: number) => {
    if (!window.confirm('Supprimer cette communication ?')) return
    try {
      await deleteCommunication(id)
      if (savedId === id) setSavedId(null)
      refreshArchives()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Traduit le choix de fond en consigne pour l'IA (vide = garder le fond d'origine).
  const ambiancePrompt = (): string | undefined => {
    if (ambiance.startsWith('Garder')) return undefined
    if (ambiance.toLowerCase().includes('enseigne')) {
      return `fond uni ou dégradé harmonieux aux couleurs de l'enseigne : ${colors.c1} et ${colors.c2}`
    }
    return ambiance
  }

  const onEnhance = async () => {
    if (!sourceFile) {
      setError('Importe d’abord une photo à sublimer.')
      return
    }
    setError(null)
    setEnhancing(true)
    try {
      // mode "scene" : préserve la photo (personnes/objets), détoure/remplace le fond choisi.
      const blob = await enhanceImage(sourceFile, ambiancePrompt(), instruction.trim() || undefined, 'scene')
      setPhotoImg(await imgFromBlob(blob))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setEnhancing(false)
    }
  }

  const onGenerateImage = async () => {
    const productText = selectedArticle
      ? `${selectedArticle.name}${selectedArticle.description ? ', ' + selectedArticle.description : ''}`
      : ''
    const prompt = [brief.trim(), productText, instruction.trim(), ambiancePrompt()]
      .filter(Boolean)
      .join('. ')
    if (!prompt) {
      setError('Décris le sujet, choisis un produit ou saisis une consigne visuelle pour générer une image.')
      return
    }
    setError(null)
    setGenImg(true)
    try {
      const blob = await generateImageFromPrompt(prompt, FORMATS[format].ar)
      setSourceFile(null)
      setPhotoImg(await imgFromBlob(blob))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setGenImg(false)
    }
  }

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Copie impossible — sélectionne le texte manuellement.')
    }
  }

  // (Re)dessine le visuel composé.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = FORMATS[format]
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pad = Math.round(w * 0.06)

    if (photoImg) {
      drawCover(ctx, photoImg, w, h)
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, colors.c1)
      g.addColorStop(1, colors.c2)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }

    // Voile bas pour lisibilité.
    const grad = ctx.createLinearGradient(0, h * 0.45, 0, h)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.8)')
    ctx.fillStyle = grad
    ctx.fillRect(0, h * 0.45, w, h * 0.55)

    // Logo (haut-droite) sur pastille blanche.
    if (logoImg) {
      const lh = Math.round(w * 0.1)
      const lw = Math.min(lh * (logoImg.width / logoImg.height), w * 0.32)
      const lx = w - pad - lw
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.beginPath()
      ctx.roundRect(lx - 12, pad - 8, lw + 24, lh + 16, 14)
      ctx.fill()
      ctx.drawImage(logoImg, lx, pad, lw, lh)
    }

    if (selectedArticle) {
      // Mise en page « pub produit » (rapatriée de la fiche article) : badge Nouveauté,
      // nom du produit, accroche, pastille prix.
      ctx.font = `bold ${Math.round(w * 0.04)}px Helvetica, Arial, sans-serif`
      const badge = 'NOUVEAUTÉ'
      const bw = ctx.measureText(badge).width + pad
      const bh = Math.round(w * 0.075)
      ctx.fillStyle = colors.c1
      ctx.beginPath()
      ctx.roundRect(pad, pad, bw, bh, bh / 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText(badge, pad + pad / 2, pad + bh / 2)

      const accroche = headline.trim()
      // Nom du produit (bas-gauche, gros), accroche juste en dessous.
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${Math.round(w * 0.075)}px Helvetica, Arial, sans-serif`
      const accrocheLines = accroche
        ? Math.min(3, Math.ceil(ctx.measureText(accroche).width / (w - 2 * pad)))
        : 0
      const nameBottom = h - pad - Math.round(w * 0.045) * (accrocheLines + 1)
      wrapText(ctx, selectedArticle.name, pad, nameBottom, w - 2 * pad - Math.round(w * 0.28), Math.round(w * 0.085))

      if (accroche) {
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        ctx.font = `${Math.round(w * 0.038)}px Helvetica, Arial, sans-serif`
        wrapText(ctx, accroche, pad, h - pad, w - 2 * pad - Math.round(w * 0.28), Math.round(w * 0.045))
      }

      // Prix (bas-droite, pastille couleur 2).
      if (selectedArticle.salePriceTtc != null) {
        const price = selectedArticle.salePriceTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
        ctx.font = `bold ${Math.round(w * 0.06)}px Helvetica, Arial, sans-serif`
        const pw = ctx.measureText(price).width + pad
        const ph = Math.round(w * 0.11)
        const px = w - pad - pw
        const py = h - pad - ph
        ctx.fillStyle = colors.c2
        ctx.beginPath()
        ctx.roundRect(px, py, pw, ph, ph / 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(price, px + pw / 2, py + ph / 2)
      }
    } else if (headline.trim()) {
      // Publication libre : une seule grande accroche en bas.
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'left'
      ctx.font = `bold ${Math.round(w * 0.08)}px Helvetica, Arial, sans-serif`
      wrapText(ctx, headline.trim(), pad, h - pad, w - 2 * pad, Math.round(w * 0.09))
    }
  }, [format, photoImg, logoImg, headline, colors, selectedArticle])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `communication-${format}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  // Export PDF prêt à imprimer pour les formats affiche (A4/A5).
  const downloadPdf = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setError(null)
    setPdfBusy(true)
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const blob = await buildPosterPdfBlob(dataUrl, format === 'a5' ? 'A5' : 'A4')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `affiche-${format}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Communication" />

      <Button
        component={RouterLink}
        to="/communication/affiche"
        variant="outlined"
        size="small"
        startIcon={<PictureAsPdfIcon />}
        sx={{ mb: 2 }}
      >
        Créer une affichette A4/A5 (éditeur libre)
      </Button>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Colonne gauche : brief + génération */}
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="text.secondary">
                1. Décris ta publication
              </Typography>
              <TextField
                select
                size="small"
                label="Produit mis en avant (optionnel)"
                value={articleId === '' ? '' : String(articleId)}
                onChange={(e) => void onSelectArticle(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <MenuItem value="">
                  <em>— Aucun (publication libre)</em>
                </MenuItem>
                {articles.map((a) => (
                  <MenuItem key={a.id} value={String(a.id)}>
                    {a.code} — {a.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Sujet / événement"
                placeholder="Ex. Nous avons offert 170 paniers au don du sang de Mulhouse"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                multiline
                minRows={3}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField select size="small" label="Réseau" value={platform} onChange={(e) => setPlatform(e.target.value)} sx={{ flex: 1 }}>
                  {PLATFORMS.map((p) => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </TextField>
                <TextField select size="small" label="Ton" value={tone} onChange={(e) => setTone(e.target.value)} sx={{ flex: 1 }}>
                  {TONES.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </TextField>
                <TextField select size="small" label="Longueur" value={length} onChange={(e) => setLength(e.target.value)} sx={{ flex: 1 }}>
                  {LENGTHS.map((l) => (
                    <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Button
                variant="contained"
                startIcon={captionLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                onClick={() => void onGenerateCaption()}
                disabled={captionLoading}
              >
                {captionLoading ? 'Rédaction…' : 'Générer la légende'}
              </Button>

              {caption && (
                <Box>
                  <TextField
                    label="Légende (modifiable)"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    multiline
                    minRows={6}
                    fullWidth
                  />
                  <Button
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => void copyCaption()}
                    sx={{ mt: 1 }}
                  >
                    {copied ? 'Copié !' : 'Copier la légende'}
                  </Button>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Colonne droite : visuel */}
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="text.secondary">
                2. Le visuel
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  select
                  size="small"
                  label="Fond / décor"
                  value={ambiance}
                  onChange={(e) => setAmbiance(e.target.value)}
                  sx={{ flex: 1 }}
                >
                  {AMBIANCES.map((a) => (
                    <MenuItem key={a} value={a}>{a}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Consigne visuelle (optionnel)"
                  placeholder="Ex. mets en valeur les paniers, ambiance solidaire"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  size="small"
                  multiline
                  minRows={1}
                  maxRows={8}
                  sx={{ flex: 1 }}
                />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button size="small" variant="contained" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
                  Importer une photo
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  startIcon={enhancing ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                  onClick={() => void onEnhance()}
                  disabled={enhancing || !sourceFile}
                >
                  Sublimer (IA)
                </Button>
                <Button
                  size="small"
                  variant="text"
                  startIcon={genImg ? <CircularProgress size={14} /> : <ImageIcon />}
                  onClick={() => void onGenerateImage()}
                  disabled={genImg}
                >
                  Générer (IA, dépannage)
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                Le meilleur rendu vient d’une <strong>vraie photo importée puis sublimée</strong>. La génération
                complète par IA est un dépannage quand tu n’as pas de photo.
              </Typography>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  void onChangePhoto(f)
                }}
              />

              <TextField
                label={selectedArticle ? 'Accroche (sur le visuel)' : 'Texte sur le visuel (optionnel)'}
                placeholder={selectedArticle ? 'Ex. La nouveauté gourmande de la semaine' : 'Ex. Merci à vous !'}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                size="small"
                helperText="Ce texte est ajouté proprement par l'appli (en français), par-dessus le visuel."
              />
              {selectedArticle && (
                <Box>
                  <Button
                    size="small"
                    startIcon={sloganLoading ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
                    onClick={() => void fetchSlogans(selectedArticle)}
                    disabled={sloganLoading}
                  >
                    {slogans.length ? 'Régénérer l’accroche' : 'Proposer une accroche'}
                  </Button>
                  {slogans.length > 0 && (
                    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 1 }}>
                      {slogans.map((s, i) => (
                        <Chip
                          key={i}
                          label={s}
                          size="small"
                          variant={s === headline ? 'filled' : 'outlined'}
                          color={s === headline ? 'primary' : 'default'}
                          onClick={() => setHeadline(s)}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              )}

              <ToggleButtonGroup size="small" exclusive value={format} onChange={(_, v) => v && setFormat(v)} fullWidth>
                {(Object.keys(FORMATS) as Fmt[]).map((f) => (
                  <ToggleButton key={f} value={f}>{FORMATS[f].label}</ToggleButton>
                ))}
              </ToggleButtonGroup>

              <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1, p: 1 }}>
                <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: 360, height: 'auto', borderRadius: 6 }} />
              </Box>

              {savedMsg && <Alert severity="success">{savedMsg}</Alert>}
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
                {savedId && (
                  <Button startIcon={<NoteAddIcon />} onClick={resetForm}>
                    Nouvelle
                  </Button>
                )}
                <Button
                  variant="outlined"
                  startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                  onClick={() => void onSave()}
                  disabled={saving}
                >
                  {savedId ? 'Mettre à jour' : 'Enregistrer'}
                </Button>
                {FORMATS[format].print && (
                  <Button
                    variant="outlined"
                    startIcon={pdfBusy ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                    onClick={() => void downloadPdf()}
                    disabled={pdfBusy}
                  >
                    Télécharger PDF
                  </Button>
                )}
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={download}>
                  Télécharger PNG
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Communications archivées */}
      {archives.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Mes communications
            </Typography>
            <Stack divider={<Divider flexItem />} spacing={0}>
              {archives.map((c) => (
                <Stack
                  key={c.id}
                  direction="row"
                  spacing={1}
                  sx={{ py: 1, alignItems: 'center' }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: savedId === c.id ? 700 : 500 }}>
                      {c.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.platform ?? '—'} · {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                    </Typography>
                  </Box>
                  <Button size="small" onClick={() => void onOpenArchive(c.id)}>
                    Ouvrir
                  </Button>
                  <Tooltip title="Supprimer">
                    <IconButton size="small" color="error" onClick={() => void onDeleteArchive(c.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </>
  )
}
