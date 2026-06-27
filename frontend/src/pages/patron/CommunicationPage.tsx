import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
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
import { errorMessage } from '../../api/client'
import { generateImageFromPrompt, generateSocialPost } from '../../api/communication'
import { enhanceImage } from '../../api/insights'
import { getProfile, getSettings, logoUrl } from '../../api/billing'
import { listMyEtablissements } from '../../api/daily'
import { PageHeader } from '../../components/PageHeader'

type Fmt = 'square' | 'story' | 'poster'
const FORMATS: Record<Fmt, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: 'Carré' },
  story: { w: 1080, h: 1920, label: 'Story' },
  poster: { w: 1240, h: 1754, label: 'Affiche' },
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
    if (!brief.trim()) {
      setError('Décris d’abord le sujet de la publication.')
      return
    }
    setError(null)
    setCaptionLoading(true)
    try {
      const res = await generateSocialPost({
        etablissement: etab.name ?? 'boulangerie',
        description: etab.description ?? null,
        location: etab.address ?? null,
        brief: brief.trim(),
        platform,
        tone,
        length,
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

  const onChangePhoto = async (file: File | undefined) => {
    if (!file) return
    setSourceFile(file)
    setPhotoImg(await imgFromBlob(file))
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
    const prompt = [brief.trim(), instruction.trim(), ambiancePrompt()].filter(Boolean).join('. ')
    if (!prompt) {
      setError('Décris le sujet (ou une consigne visuelle) pour générer une image.')
      return
    }
    setError(null)
    setGenImg(true)
    try {
      const blob = await generateImageFromPrompt(prompt)
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

    // Accroche (bas-gauche, grosse).
    if (headline.trim()) {
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'left'
      ctx.font = `bold ${Math.round(w * 0.08)}px Helvetica, Arial, sans-serif`
      wrapText(ctx, headline.trim(), pad, h - pad, w - 2 * pad, Math.round(w * 0.09))
    }
  }, [format, photoImg, logoImg, headline, colors])

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

  return (
    <>
      <PageHeader title="Communication" />

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
                  sx={{ flex: 1 }}
                />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
                  Importer une photo
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={enhancing ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
                  onClick={() => void onEnhance()}
                  disabled={enhancing || !sourceFile}
                >
                  Sublimer (IA)
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={genImg ? <CircularProgress size={14} /> : <ImageIcon />}
                  onClick={() => void onGenerateImage()}
                  disabled={genImg}
                >
                  Générer une image (IA)
                </Button>
              </Stack>
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
                label="Texte sur le visuel (optionnel)"
                placeholder="Ex. Merci à vous !"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                size="small"
              />

              <ToggleButtonGroup size="small" exclusive value={format} onChange={(_, v) => v && setFormat(v)} fullWidth>
                {(Object.keys(FORMATS) as Fmt[]).map((f) => (
                  <ToggleButton key={f} value={f}>{FORMATS[f].label}</ToggleButton>
                ))}
              </ToggleButtonGroup>

              <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1, p: 1 }}>
                <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: 360, height: 'auto', borderRadius: 6 }} />
              </Box>

              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                <Tooltip title="Télécharger le visuel">
                  <span>
                    <IconButton color="primary" onClick={download}>
                      <DownloadIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button variant="contained" startIcon={<DownloadIcon />} onClick={download}>
                  Télécharger
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </>
  )
}
