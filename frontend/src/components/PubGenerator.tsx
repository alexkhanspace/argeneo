import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import UploadIcon from '@mui/icons-material/Upload'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import { errorMessage } from '../api/client'
import { enhanceImage, getAdSlogans } from '../api/insights'
import { getProfile, getSettings, logoUrl } from '../api/billing'
import { photoUrl, uploadArticlePhoto } from '../api/costing'
import { listMyEtablissements } from '../api/daily'
import type { Article } from '../api/types'
import { Modal } from './Modal'

type Fmt = 'square' | 'story' | 'poster'
const FORMATS: Record<Fmt, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: 'Carré' },
  story: { w: 1080, h: 1920, label: 'Story' },
  poster: { w: 1240, h: 1754, label: 'Affiche' },
}

const AMBIANCES = [
  'Fond ardoise élégant',
  'Planche en bois rustique',
  'Fond clair épuré (studio)',
  'Table dressée lifestyle',
  "Fond aux couleurs de l'enseigne",
]

const safeColor = (c: string | null | undefined, fb: string) =>
  c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fb

/** Charge un blob en HTMLImageElement (object URL, pas de taint canvas). */
function imgFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = URL.createObjectURL(blob)
  })
}

/** Charge une image en data-URL (évite le taint canvas / service worker). */
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
): number {
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
  return lines.length * lineH
}

export function PubGenerator({
  open,
  onClose,
  article,
  onPhotoSaved,
}: {
  open: boolean
  onClose: () => void
  article: Article
  /** Notifie le parent quand la photo sublimée est enregistrée comme photo du produit. */
  onPhotoSaved?: (updated: Article) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [format, setFormat] = useState<Fmt>('square')
  const [slogans, setSlogans] = useState<string[]>([])
  const [slogan, setSlogan] = useState('')
  const [sloganLoading, setSloganLoading] = useState(false)
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null)
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  const [colors, setColors] = useState({ c1: '#b5651d', c2: '#9a5417', c3: '#b5651d' })
  const [etabCtx, setEtabCtx] = useState<{ name?: string; description?: string | null; address?: string | null }>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Mode source du visuel : photo de l'article, ou photo réelle sublimée par l'IA.
  const [source, setSource] = useState<'article' | 'real'>('article')
  const [ambiance, setAmbiance] = useState(AMBIANCES[0])
  // Consigne libre du client pour guider la mise en scène (pose, angle, recadrage…).
  const [instruction, setInstruction] = useState('')
  const [enhancing, setEnhancing] = useState(false)
  // Photo source à sublimer : null = la photo de l'article ; sinon une photo importée.
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  // Dernier rendu sublimé (image détourée/mise en valeur) conservé pour pouvoir l'enregistrer.
  const [enhancedBlob, setEnhancedBlob] = useState<Blob | null>(null)
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const fetchArticleAsFile = async (): Promise<File | null> => {
    const url = photoUrl(article.photoFile)
    if (!url) return null
    const res = await fetch(url)
    const blob = await res.blob()
    return new File([blob], 'photo.png', { type: blob.type || 'image/png' })
  }

  // Remplace la photo source (import) — aperçu de l'original, sans encore sublimer.
  const onChangePhoto = async (file: File | undefined) => {
    if (!file) return
    setSourceFile(file)
    setEnhancedBlob(null) // l'aperçu importé n'est pas (encore) une image sublimée
    setSavedMsg(null)
    setPhotoImg(await imgFromBlob(file))
  }

  // Sublime la photo source courante (article par défaut, ou celle importée).
  const sublime = async () => {
    setError(null)
    setSavedMsg(null)
    setEnhancing(true)
    try {
      const file = sourceFile ?? (await fetchArticleAsFile())
      if (!file) {
        setError('Aucune photo à sublimer — importe-en une.')
        return
      }
      // Si l'ambiance vise les couleurs de l'enseigne, on transmet les vrais hex à l'IA.
      const amb = ambiance.toLowerCase().includes('enseigne')
        ? `fond uni ou dégradé harmonieux aux couleurs de l'enseigne : ${colors.c1} et ${colors.c2}`
        : ambiance
      const blob = await enhanceImage(file, amb, instruction.trim() || undefined)
      setEnhancedBlob(blob)
      setPhotoImg(await imgFromBlob(blob))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setEnhancing(false)
    }
  }

  // Enregistre l'image sublimée (détourée + mise en valeur) comme photo officielle du produit.
  const saveAsArticlePhoto = async () => {
    if (!enhancedBlob) return
    setError(null)
    setSavedMsg(null)
    setSavingPhoto(true)
    try {
      const file = new File([enhancedBlob], `article-${article.code}.png`, { type: 'image/png' })
      const updated = await uploadArticlePhoto(article.id, file)
      setSavedMsg('Photo enregistrée comme photo du produit.')
      onPhotoSaved?.(updated)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSavingPhoto(false)
    }
  }

  // Chargement initial à l'ouverture : charte, photo, contexte, accroches.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setLoading(true)
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
            c3: safeColor(settings.brandColor3, safeColor(settings.brandColor1, '#b5651d')),
          })
        }
        const e = etabs[0]
        setEtabCtx({ name: e?.name, description: e?.description, address: e?.address })
        const [pi, li] = await Promise.all([
          loadImage(photoUrl(article.photoFile)),
          loadImage(profile?.logoFile ? logoUrl(profile.logoFile) : null),
        ])
        if (cancelled) return
        setPhotoImg(pi)
        setLogoImg(li)
        await fetchSlogans(e?.name, e?.description, e?.address)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, article.id])

  const fetchSlogans = async (name?: string, description?: string | null, address?: string | null) => {
    setSloganLoading(true)
    try {
      const res = await getAdSlogans({
        etablissement: name ?? etabCtx.name ?? 'boulangerie',
        description: description ?? etabCtx.description ?? null,
        location: address ?? etabCtx.address ?? null,
        articleName: article.name,
        articleDescription: article.description,
        priceTtc: article.salePriceTtc,
      })
      const list = res.enabled ? res.slogans : []
      setSlogans(list)
      if (list.length) setSlogan(list[0])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSloganLoading(false)
    }
  }

  // (Re)dessine le visuel à chaque changement.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !open) return
    const { w, h } = FORMATS[format]
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pad = Math.round(w * 0.06)

    // Fond : photo en cover, sinon dégradé de marque.
    if (photoImg) {
      drawCover(ctx, photoImg, w, h)
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, colors.c1)
      g.addColorStop(1, colors.c2)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }

    // Voile dégradé bas pour la lisibilité du texte.
    const grad = ctx.createLinearGradient(0, h * 0.4, 0, h)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.8)')
    ctx.fillStyle = grad
    ctx.fillRect(0, h * 0.4, w, h * 0.6)

    // Badge NOUVEAUTÉ (haut-gauche).
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

    // Nom du produit (bas-gauche, gros).
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.round(w * 0.075)}px Helvetica, Arial, sans-serif`
    const sloganLines = slogan ? Math.min(3, Math.ceil(ctx.measureText(slogan).width / (w - 2 * pad))) : 0
    const nameBottom = h - pad - Math.round(w * 0.045) * (sloganLines + 1)
    wrapText(ctx, article.name, pad, nameBottom, w - 2 * pad - Math.round(w * 0.28), Math.round(w * 0.085))

    // Accroche (sous le nom).
    if (slogan) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.font = `${Math.round(w * 0.038)}px Helvetica, Arial, sans-serif`
      wrapText(ctx, slogan, pad, h - pad, w - 2 * pad - Math.round(w * 0.28), Math.round(w * 0.045))
    }

    // Prix (bas-droite, pastille couleur 2).
    if (article.salePriceTtc != null) {
      const price = article.salePriceTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
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
  }, [open, format, photoImg, logoImg, slogan, colors, article])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pub-${article.code}-${format}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  return (
    <Modal open={open} onClose={onClose} title={`Pub — ${article.name}`}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {source === 'article' && !article.photoFile && (
          <Alert severity="info">
            Astuce : ajoute (ou génère par IA) une photo de l'article, ou utilise « Photo réelle » ci-dessous.
          </Alert>
        )}

        {/* Source du visuel */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={source}
          onChange={(_, v) => {
            if (!v) return
            setSource(v)
            setSourceFile(null)
            setEnhancedBlob(null)
            setSavedMsg(null)
            void loadImage(photoUrl(article.photoFile)).then(setPhotoImg)
          }}
          fullWidth
        >
          <ToggleButton value="article">Photo de l'article</ToggleButton>
          <ToggleButton value="real">Photo réelle (IA)</ToggleButton>
        </ToggleButtonGroup>

        {source === 'real' && (
          <Stack spacing={1}>
            <TextField
              select
              size="small"
              label="Ambiance / décor"
              value={ambiance}
              onChange={(e) => setAmbiance(e.target.value)}
            >
              {AMBIANCES.map((a) => (
                <MenuItem key={a} value={a}>
                  {a}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Consigne (optionnel)"
              placeholder="Ex. couche la baguette à l'horizontale, vue 3/4, gros plan…"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              multiline
              minRows={2}
            />
            <Button
              variant="contained"
              startIcon={enhancing ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={() => void sublime()}
              disabled={enhancing}
            >
              {enhancing ? 'Mise en scène IA…' : 'Sublimer (IA)'}
            </Button>
            <Button
              variant="text"
              size="small"
              startIcon={<UploadIcon />}
              onClick={() => fileRef.current?.click()}
              disabled={enhancing}
              sx={{ alignSelf: 'flex-start' }}
            >
              {sourceFile ? 'Changer la photo importée' : 'Importer une autre photo'}
            </Button>
            {enhancedBlob && (
              <Button
                variant="outlined"
                startIcon={savingPhoto ? <CircularProgress size={14} /> : <AddPhotoAlternateIcon />}
                onClick={() => void saveAsArticlePhoto()}
                disabled={savingPhoto}
              >
                {savingPhoto ? 'Enregistrement…' : 'Conserver comme photo du produit'}
              </Button>
            )}
            {savedMsg && <Alert severity="success">{savedMsg}</Alert>}
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
          </Stack>
        )}

        {/* Format d'export */}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={format}
          onChange={(_, v) => v && setFormat(v)}
          fullWidth
        >
          {(Object.keys(FORMATS) as Fmt[]).map((f) => (
            <ToggleButton key={f} value={f}>
              {FORMATS[f].label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1, p: 1 }}>
          {loading ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 4 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Préparation…
              </Typography>
            </Stack>
          ) : (
            <canvas
              ref={canvasRef}
              style={{ maxWidth: '100%', maxHeight: 360, height: 'auto', borderRadius: 6 }}
            />
          )}
        </Box>

        <TextField
          label="Accroche"
          value={slogan}
          onChange={(e) => setSlogan(e.target.value)}
          multiline
          minRows={2}
        />
        {slogans.length > 0 && (
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {slogans.map((s, i) => (
              <Chip
                key={i}
                label={s}
                size="small"
                variant={s === slogan ? 'filled' : 'outlined'}
                color={s === slogan ? 'primary' : 'default'}
                onClick={() => setSlogan(s)}
              />
            ))}
          </Stack>
        )}

        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={sloganLoading ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
            onClick={() => void fetchSlogans()}
            disabled={sloganLoading}
          >
            Régénérer l'accroche
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={download} disabled={loading}>
            Télécharger
          </Button>
        </Stack>
      </Stack>
    </Modal>
  )
}
