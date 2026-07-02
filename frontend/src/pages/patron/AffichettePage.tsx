import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import UploadIcon from '@mui/icons-material/Upload'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import DownloadIcon from '@mui/icons-material/Download'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import SaveIcon from '@mui/icons-material/Save'
import DeleteIcon from '@mui/icons-material/Delete'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { errorMessage } from '../../api/client'
import { getProfile, getSettings, logoUrl } from '../../api/billing'
import { listArticles, photoUrl } from '../../api/costing'
import { composeImages, enhanceImage } from '../../api/insights'
import { generateImageFromPrompt, saveCommunication } from '../../api/communication'
import type { Article } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { buildPosterPdfBlob } from '../../pdf/buildPosterPdf'

type Fmt = 'a4' | 'a5'
const FORMATS: Record<Fmt, { w: number; h: number; label: string; size: 'A4' | 'A5' }> = {
  a4: { w: 1240, h: 1754, label: 'A4', size: 'A4' },
  a5: { w: 874, h: 1240, label: 'A5', size: 'A5' },
}
type BgMode = 'photo' | 'brand' | 'solid'
type Align = 'left' | 'center' | 'right'

/** Un bloc de texte libre, positionné en fractions (0..1) de l'affichette. */
interface Block {
  id: string
  text: string
  xPct: number
  yPct: number
  wPct: number
  fontPct: number // taille de police en fraction de la largeur
  color: string
  bold: boolean
  align: Align
  bg: string | null // pastille de fond, ou null
  font?: string // famille de police (défaut : FONT)
}

const FONT = 'Helvetica, Arial, sans-serif'
// Familles système uniquement : elles rendent à l'identique dans l'aperçu CSS et le canvas d'export.
const FONTS = [
  { label: 'Moderne', value: FONT },
  { label: 'Élégante (serif)', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Impact (titres)', value: 'Impact, "Arial Black", sans-serif' },
  { label: 'Manuscrite', value: '"Brush Script MT", "Segoe Script", cursive' },
  { label: 'Ardoise', value: '"Chalkboard SE", "Comic Sans MS", cursive' },
  { label: 'Machine à écrire', value: '"Courier New", Courier, monospace' },
]
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const safeColor = (c: string | null | undefined, fb: string) =>
  c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fb

const DRAFT_KEY = 'argeneo.affichette.draft'

function imgFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = URL.createObjectURL(blob)
  })
}
/** Charge une image distante en data-URL (évite le taint canvas). */
function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return fetch(url)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('img'))))
    .then(imgFromBlob)
    .catch(() => null)
}
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const r = Math.max(w / img.width, h / img.height)
  const iw = img.width * r
  const ih = img.height * r
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih)
}
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line)
        line = w
      } else line = test
    }
    out.push(line)
  }
  return out
}

let seq = 0
const newId = () => `b${Date.now()}${seq++}`

function newBlock(partial: Partial<Block>): Block {
  return {
    id: newId(),
    text: 'Texte',
    xPct: 0.1,
    yPct: 0.42,
    wPct: 0.8,
    fontPct: 0.06,
    color: '#ffffff',
    bold: true,
    align: 'center',
    bg: null,
    ...partial,
  }
}

/**
 * Éditeur d'affichette « type Canva » : des blocs de texte déplaçables/redimensionnables à la
 * souris par-dessus un fond (photo ou couleurs de l'enseigne). Export PNG/PDF (A4/A5) + sauvegarde.
 */
export function AffichettePage() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [format, setFormat] = useState<Fmt>('a4')
  const [blocks, setBlocks] = useState<Block[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
      if (raw && Array.isArray(raw.blocks)) return raw.blocks as Block[]
    } catch {
      // pas de brouillon
    }
    return [
      newBlock({ text: 'Votre titre', yPct: 0.62, fontPct: 0.09, align: 'left', xPct: 0.06, wPct: 0.88 }),
      newBlock({ text: 'Votre accroche ici', yPct: 0.78, fontPct: 0.045, align: 'left', xPct: 0.06, wPct: 0.88, bold: false }),
    ]
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [bgMode, setBgMode] = useState<BgMode>('brand')
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [solid, setSolid] = useState('#c2410c')
  const [veil, setVeil] = useState(0.35)
  const [colors, setColors] = useState({ c1: '#c2410c', c2: '#9a5417' })
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  const [showLogo, setShowLogo] = useState(true)

  const [articles, setArticles] = useState<Article[]>([])
  const [articleId, setArticleId] = useState<number | ''>('')

  const [enhancing, setEnhancing] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState<null | 'retouch' | 'generate' | 'compose'>(null)
  const [menuArticles, setMenuArticles] = useState<Article[]>([])
  const [menuFiles, setMenuFiles] = useState<File[]>([])
  const menuFileRef = useRef<HTMLInputElement | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId])
  const fmt = FORMATS[format]

  // Chargement charte + produits + logo.
  useEffect(() => {
    listArticles().then(setArticles).catch(() => undefined)
    getSettings()
      .then((s) => {
        const c1 = safeColor(s.brandColor1, '#c2410c')
        const c2 = safeColor(s.brandColor2, c1)
        setColors({ c1, c2 })
        setSolid(c1)
      })
      .catch(() => undefined)
    getProfile()
      .then((p) => loadImage(p.logoFile ? logoUrl(p.logoFile) : null).then(setLogoImg))
      .catch(() => undefined)
  }, [])

  // Autosave du brouillon (blocs uniquement — le fond image reste local à la session).
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ blocks }))
    } catch {
      // quota : on ignore
    }
  }, [blocks])

  const updateBlock = (id: string, patch: Partial<Block>) =>
    setBlocks((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  const removeBlock = (id: string) => {
    setBlocks((list) => list.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
  }
  const addBlock = () => {
    const b = newBlock({ text: 'Nouveau texte', yPct: 0.3 })
    setBlocks((list) => [...list, b])
    setSelectedId(b.id)
  }

  // Suppr/Retour efface le bloc sélectionné (sauf pendant la saisie), Échap désélectionne.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeBlock(selectedId)
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // --- Déplacement / redimensionnement à la souris ---
  // 'resize' = largeur seule (poignée latérale) ; 'scale' = largeur + police (poignée d'angle).
  const drag = useRef<
    | { id: string; mode: 'move' | 'resize' | 'scale'; startX: number; startY: number; b: Block; rect: DOMRect }
    | null
  >(null)

  const onPointerDown = (e: ReactPointerEvent, id: string, mode: 'move' | 'resize' | 'scale') => {
    e.preventDefault()
    e.stopPropagation()
    const stage = stageRef.current
    const b = blocks.find((x) => x.id === id)
    if (!stage || !b) return
    setSelectedId(id)
    drag.current = { id, mode, startX: e.clientX, startY: e.clientY, b, rect: stage.getBoundingClientRect() }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.startX) / d.rect.width
    const dy = (e.clientY - d.startY) / d.rect.height
    if (d.mode === 'move') {
      updateBlock(d.id, {
        xPct: clamp01(d.b.xPct + dx),
        yPct: clamp01(d.b.yPct + dy),
      })
    } else {
      const wPct = Math.max(0.08, Math.min(1 - d.b.xPct, d.b.wPct + dx))
      if (d.mode === 'scale') {
        // La police suit la largeur : agrandir la zone agrandit le texte (façon Canva).
        const fontPct = Math.max(0.015, Math.min(0.3, d.b.fontPct * (wPct / d.b.wPct)))
        updateBlock(d.id, { wPct, fontPct })
      } else {
        updateBlock(d.id, { wPct })
      }
    }
  }
  const onPointerUp = () => {
    drag.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }
  useEffect(() => () => onPointerUp(), [])

  // --- Fond ---
  const onImportPhoto = async (file: File | undefined) => {
    if (!file) return
    setSourceFile(file)
    setBgImg(await imgFromBlob(file))
    setBgMode('photo')
  }
  const onUseArticle = async (id: number | '') => {
    setArticleId(id)
    if (id === '') return
    const a = articles.find((x) => x.id === id)
    if (!a) return
    // Pré-remplit un titre + prix depuis le produit.
    setBlocks((list) => {
      const withoutSeed = list
      const title = newBlock({ text: a.name, yPct: 0.6, fontPct: 0.09, align: 'left', xPct: 0.06, wPct: 0.88 })
      const price =
        a.salePriceTtc != null
          ? [
              newBlock({
                text: a.salePriceTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €',
                yPct: 0.85,
                xPct: 0.6,
                wPct: 0.34,
                fontPct: 0.07,
                align: 'center',
                bg: colors.c2,
              }),
            ]
          : []
      return [...withoutSeed, title, ...price]
    })
    // Charge la photo du produit en fond si dispo.
    if (a.photoFile) {
      const img = await loadImage(photoUrl(a.photoFile))
      if (img) {
        setBgImg(img)
        setBgMode('photo')
        setSourceFile(null)
      }
    }
  }
  const sublimeBg = async () => {
    if (!sourceFile) {
      setError('Importe d’abord une photo à sublimer.')
      return
    }
    setError(null)
    setEnhancing(true)
    try {
      const amb = `fond uni ou dégradé harmonieux aux couleurs de l'enseigne : ${colors.c1} et ${colors.c2}`
      const blob = await enhanceImage(sourceFile, amb, undefined, 'scene')
      setBgImg(await imgFromBlob(blob))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setEnhancing(false)
    }
  }

  // --- IA : retouche du fond, génération, composition menu ---
  /** Le fond actuel (déjà sublimé/généré ou non) converti en fichier PNG pour l'IA. */
  const bgToFile = async (): Promise<File | null> => {
    if (!bgImg) return null
    const c = document.createElement('canvas')
    c.width = bgImg.naturalWidth || bgImg.width
    c.height = bgImg.naturalHeight || bgImg.height
    c.getContext('2d')!.drawImage(bgImg, 0, 0)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
    return blob ? new File([blob], 'fond.png', { type: 'image/png' }) : null
  }

  /** Retouche le fond actuel selon la consigne libre (les textes restent par-dessus, intacts). */
  const retouchBg = async () => {
    if (bgMode !== 'photo' || !bgImg) {
      setError('Choisis d’abord un fond photo (importe une photo, un produit, ou génère un fond IA).')
      return
    }
    if (!aiPrompt.trim()) {
      setError('Écris d’abord ta consigne pour l’IA dans la zone de texte libre.')
      return
    }
    setError(null)
    setAiBusy('retouch')
    try {
      const f = await bgToFile()
      if (!f) throw new Error('Fond illisible')
      const blob = await enhanceImage(f, undefined, aiPrompt.trim(), 'scene')
      setBgImg(await imgFromBlob(blob))
      setBgMode('photo')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setAiBusy(null)
    }
  }

  /** Génère un fond de zéro (texte → image) à partir de la consigne libre. */
  const generateBg = async () => {
    if (!aiPrompt.trim()) {
      setError('Décris le fond souhaité dans la zone de texte libre (ex. « vitrine de Noël, ambiance chaleureuse »).')
      return
    }
    setError(null)
    setAiBusy('generate')
    try {
      const blob = await generateImageFromPrompt(aiPrompt.trim())
      setBgImg(await imgFromBlob(blob))
      setBgMode('photo')
      setSourceFile(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setAiBusy(null)
    }
  }

  /** Compose une affiche « menu » : l'IA met en scène les VRAIES photos des produits choisis. */
  const composeMenu = async () => {
    const withPhoto = menuArticles.filter((a) => a.photoFile)
    if (withPhoto.length + menuFiles.length === 0) {
      setError('Sélectionne des produits qui ont une photo, ou importe des photos pour le menu.')
      return
    }
    setError(null)
    setAiBusy('compose')
    try {
      const files: File[] = [...menuFiles]
      for (const a of withPhoto) {
        const u = photoUrl(a.photoFile)
        if (!u) continue
        const r = await fetch(u)
        if (!r.ok) continue
        const blob = await r.blob()
        files.push(new File([blob], `produit-${a.id}.png`, { type: blob.type || 'image/png' }))
      }
      if (files.length === 0) throw new Error('Aucune photo exploitable')
      const blob = await composeImages(files, aiPrompt.trim() || undefined)
      setBgImg(await imgFromBlob(blob))
      setBgMode('photo')
      setSourceFile(null)
      // Pré-remplit un bloc « carte » avec les produits choisis (nom + prix), librement éditable.
      if (menuArticles.length > 0) {
        const lines = menuArticles
          .map((a) =>
            a.salePriceTtc != null
              ? `${a.name} — ${a.salePriceTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
              : a.name,
          )
          .join('\n')
        const b = newBlock({ text: lines, yPct: 0.5, xPct: 0.08, wPct: 0.84, fontPct: 0.04, align: 'left' })
        setBlocks((list) => [...list, b])
        setSelectedId(b.id)
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setAiBusy(null)
    }
  }

  // --- Rendu haute résolution (export) ---
  const renderToCanvas = (): HTMLCanvasElement => {
    const { w, h } = fmt
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    // Fond
    if (bgMode === 'photo' && bgImg) {
      drawCover(ctx, bgImg, w, h)
    } else if (bgMode === 'solid') {
      ctx.fillStyle = solid
      ctx.fillRect(0, 0, w, h)
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, colors.c1)
      g.addColorStop(1, colors.c2)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
    // Voile bas pour lisibilité
    if (veil > 0) {
      const grad = ctx.createLinearGradient(0, h * 0.35, 0, h)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(0,0,0,${veil})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, h * 0.35, w, h * 0.65)
    }
    // Logo (haut-droite)
    if (showLogo && logoImg) {
      const pad = Math.round(w * 0.05)
      const lh = Math.round(w * 0.11)
      const lw = Math.min(lh * (logoImg.width / logoImg.height), w * 0.34)
      const lx = w - pad - lw
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.beginPath()
      ctx.roundRect(lx - 12, pad - 8, lw + 24, lh + 16, 14)
      ctx.fill()
      ctx.drawImage(logoImg, lx, pad, lw, lh)
    }
    // Blocs de texte
    for (const b of blocks) {
      const x = b.xPct * w
      const y = b.yPct * h
      const maxW = b.wPct * w
      const fontSize = b.fontPct * w
      ctx.font = `${b.bold ? 'bold ' : ''}${fontSize}px ${b.font ?? FONT}`
      ctx.textBaseline = 'top'
      const lineH = fontSize * 1.2
      const lines = wrapLines(ctx, b.text, maxW)
      let mw = 0
      for (const l of lines) mw = Math.max(mw, ctx.measureText(l).width)
      if (b.bg) {
        const p = fontSize * 0.3
        let bx = x
        if (b.align === 'center') bx = x + (maxW - mw) / 2
        else if (b.align === 'right') bx = x + (maxW - mw)
        ctx.fillStyle = b.bg
        ctx.beginPath()
        ctx.roundRect(bx - p, y - p, mw + p * 2, lines.length * lineH + p * 2, fontSize * 0.28)
        ctx.fill()
      }
      ctx.fillStyle = b.color
      ctx.textAlign = b.align
      const tx = b.align === 'center' ? x + maxW / 2 : b.align === 'right' ? x + maxW : x
      let ty = y
      for (const l of lines) {
        ctx.fillText(l, tx, ty)
        ty += lineH
      }
    }
    return canvas
  }

  const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))

  const downloadPng = async () => {
    const blob = await canvasToBlob(renderToCanvas())
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `affichette-${format}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  const downloadPdf = async () => {
    setError(null)
    setPdfBusy(true)
    try {
      const dataUrl = renderToCanvas().toDataURL('image/png')
      const blob = await buildPosterPdfBlob(dataUrl, fmt.size)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `affichette-${format}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPdfBusy(false)
    }
  }
  const save = async () => {
    setError(null)
    setSavedMsg(null)
    setSaving(true)
    try {
      const blob = await canvasToBlob(renderToCanvas())
      const headline = blocks[0]?.text?.slice(0, 200) || 'Affichette'
      await saveCommunication(
        { headline, articleId: articleId === '' ? null : articleId, platform: `Affichette ${fmt.label}` },
        blob,
      )
      setSavedMsg('Affichette enregistrée dans « Communication ».')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // Fond CSS de l'aperçu (miroir du rendu canvas).
  const stageBg =
    bgMode === 'photo' && bgImg
      ? { backgroundImage: `url(${bgImg.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : bgMode === 'solid'
        ? { background: solid }
        : { background: `linear-gradient(${colors.c1}, ${colors.c2})` }

  return (
    <>
      <PageHeader
        title="Affichette"
        subtitle="Compose une affiche A4/A5 : glisse et redimensionne les textes, choisis un fond, exporte en PDF ou enregistre-la."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {savedMsg && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSavedMsg(null)}>
          {savedMsg}
        </Alert>
      )}

      <Button component={RouterLink} to="/communication" size="small" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>
        Retour à Communication
      </Button>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px' }, gap: 2 }}>
        {/* Scène (aperçu éditable) */}
        <Card>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
              <ToggleButtonGroup size="small" exclusive value={format} onChange={(_, v) => v && setFormat(v)}>
                {(Object.keys(FORMATS) as Fmt[]).map((f) => (
                  <ToggleButton key={f} value={f}>
                    {FORMATS[f].label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Button size="small" startIcon={<AddIcon />} onClick={addBlock}>
                Ajouter un texte
              </Button>
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1, p: 1 }}>
              <Box
                ref={stageRef}
                onPointerDown={() => setSelectedId(null)}
                sx={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 460,
                  aspectRatio: `${fmt.w} / ${fmt.h}`,
                  containerType: 'inline-size',
                  overflow: 'hidden',
                  borderRadius: 1,
                  userSelect: 'none',
                  touchAction: 'none',
                  ...stageBg,
                }}
              >
                {/* Voile */}
                {veil > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background: `linear-gradient(rgba(0,0,0,0) 35%, rgba(0,0,0,${veil}))`,
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {/* Logo */}
                {showLogo && logoImg && (
                  <Box
                    component="img"
                    src={logoImg.src}
                    alt=""
                    sx={{
                      position: 'absolute',
                      top: '4%',
                      right: '5%',
                      maxWidth: '32%',
                      maxHeight: '14%',
                      objectFit: 'contain',
                      bgcolor: 'rgba(255,255,255,0.92)',
                      borderRadius: 1,
                      p: 0.5,
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {/* Blocs */}
                {blocks.map((b) => {
                  const isSel = b.id === selectedId
                  return (
                    <Box
                      key={b.id}
                      onPointerDown={(e) => onPointerDown(e, b.id, 'move')}
                      sx={{
                        position: 'absolute',
                        left: `${b.xPct * 100}%`,
                        top: `${b.yPct * 100}%`,
                        width: `${b.wPct * 100}%`,
                        textAlign: b.align,
                        cursor: 'move',
                        outline: isSel ? '1.5px dashed rgba(255,255,255,0.9)' : 'none',
                        outlineOffset: 2,
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          maxWidth: '100%',
                          color: b.color,
                          fontFamily: b.font ?? FONT,
                          fontWeight: b.bold ? 700 : 400,
                          lineHeight: 1.2,
                          whiteSpace: 'pre-wrap',
                          ...(b.bg
                            ? { bgcolor: b.bg, borderRadius: 1, px: 0.6, py: 0.2 }
                            : {}),
                        }}
                        style={{ fontSize: `${b.fontPct * 100}cqw` }}
                      >
                        {b.text || ' '}
                      </Box>
                      {isSel && (
                        <>
                          {/* Poignée d'angle : agrandit la zone ET la police (proportionnel). */}
                          <Box
                            onPointerDown={(e) => onPointerDown(e, b.id, 'scale')}
                            sx={{
                              position: 'absolute',
                              right: -6,
                              bottom: -6,
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              border: '2px solid #fff',
                              cursor: 'nwse-resize',
                            }}
                          />
                          {/* Poignée latérale : largeur seule (le texte se reflowe). */}
                          <Box
                            onPointerDown={(e) => onPointerDown(e, b.id, 'resize')}
                            sx={{
                              position: 'absolute',
                              right: -5,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 8,
                              height: 22,
                              borderRadius: 1,
                              bgcolor: 'primary.main',
                              border: '2px solid #fff',
                              cursor: 'ew-resize',
                            }}
                          />
                        </>
                      )}
                    </Box>
                  )
                })}
              </Box>
            </Box>

            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1, mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                onClick={() => void save()}
                disabled={saving}
              >
                Enregistrer
              </Button>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void downloadPng()}>
                PNG
              </Button>
              <Button
                variant="contained"
                startIcon={pdfBusy ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
                onClick={() => void downloadPdf()}
                disabled={pdfBusy}
              >
                PDF
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Panneau de réglages */}
        <Card>
          <CardContent>
            <Stack spacing={2}>
              {/* Bloc sélectionné */}
              <Typography variant="subtitle2" color="text.secondary">
                Texte sélectionné
              </Typography>
              {selected ? (
                <>
                  <TextField
                    label="Texte"
                    value={selected.text}
                    onChange={(e) => updateBlock(selected.id, { text: e.target.value })}
                    multiline
                    minRows={2}
                    size="small"
                  />
                  <TextField
                    select
                    size="small"
                    label="Police"
                    value={selected.font ?? FONT}
                    onChange={(e) => updateBlock(selected.id, { font: e.target.value })}
                  >
                    {FONTS.map((f) => (
                      <MenuItem key={f.value} value={f.value} sx={{ fontFamily: f.value }}>
                        {f.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Taille (× {(selected.fontPct * 100).toFixed(1)})
                    </Typography>
                    <Slider
                      value={selected.fontPct}
                      onChange={(_, v) => updateBlock(selected.id, { fontPct: Array.isArray(v) ? v[0] : v })}
                      min={0.02}
                      max={0.18}
                      step={0.005}
                      size="small"
                    />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={selected.align}
                      onChange={(_, v: Align | null) => v && updateBlock(selected.id, { align: v })}
                    >
                      <ToggleButton value="left">Gauche</ToggleButton>
                      <ToggleButton value="center">Centre</ToggleButton>
                      <ToggleButton value="right">Droite</ToggleButton>
                    </ToggleButtonGroup>
                    <Tooltip title="Gras">
                      <IconButton
                        size="small"
                        color={selected.bold ? 'primary' : 'default'}
                        onClick={() => updateBlock(selected.id, { bold: !selected.bold })}
                      >
                        <FormatBoldIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <TextField
                      type="color"
                      size="small"
                      label="Couleur"
                      value={selected.color}
                      onChange={(e) => updateBlock(selected.id, { color: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{ width: 90 }}
                    />
                    <TextField
                      type="color"
                      size="small"
                      label="Pastille"
                      value={selected.bg ?? '#000000'}
                      onChange={(e) => updateBlock(selected.id, { bg: e.target.value })}
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{ width: 90 }}
                    />
                    {selected.bg && (
                      <Button size="small" onClick={() => updateBlock(selected.id, { bg: null })}>
                        Sans pastille
                      </Button>
                    )}
                  </Stack>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => removeBlock(selected.id)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Supprimer ce texte
                  </Button>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Clique un texte sur l’affichette pour le modifier, ou « Ajouter un texte ». Touche
                  Suppr : efface le texte sélectionné. Poignée d’angle : agrandit zone et police.
                </Typography>
              )}

              <Divider />

              {/* Fond */}
              <Typography variant="subtitle2" color="text.secondary">
                Fond
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={bgMode}
                onChange={(_, v: BgMode | null) => v && setBgMode(v)}
                fullWidth
              >
                <ToggleButton value="brand">Enseigne</ToggleButton>
                <ToggleButton value="solid">Uni</ToggleButton>
                <ToggleButton value="photo">Photo</ToggleButton>
              </ToggleButtonGroup>

              {bgMode === 'solid' && (
                <TextField
                  type="color"
                  size="small"
                  label="Couleur du fond"
                  value={solid}
                  onChange={(e) => setSolid(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: 120 }}
                />
              )}

              <TextField
                select
                size="small"
                label="Produit (fond + prix)"
                value={articleId === '' ? '' : String(articleId)}
                onChange={(e) => void onUseArticle(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <MenuItem value="">
                  <em>— Aucun</em>
                </MenuItem>
                {articles.map((a) => (
                  <MenuItem key={a.id} value={String(a.id)}>
                    {a.code} — {a.name}
                  </MenuItem>
                ))}
              </TextField>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
                  Importer une photo
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={enhancing ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
                  onClick={() => void sublimeBg()}
                  disabled={enhancing || !sourceFile}
                >
                  Sublimer (IA)
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
                  void onImportPhoto(f)
                }}
              />

              <Divider />

              {/* IA : consigne libre + retouche / génération / composition menu */}
              <Typography variant="subtitle2" color="text.secondary">
                IA — retouche &amp; génération
              </Typography>
              <TextField
                label="Consigne libre pour l’IA"
                placeholder="Ex. : ambiance marché de Noël, fond bois chaleureux, lumière dorée…"
                multiline
                minRows={2}
                size="small"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={aiBusy === 'retouch' ? <CircularProgress size={14} /> : <AutoFixHighIcon />}
                  onClick={() => void retouchBg()}
                  disabled={aiBusy !== null}
                >
                  Retoucher le fond (IA)
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={aiBusy === 'generate' ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
                  onClick={() => void generateBg()}
                  disabled={aiBusy !== null}
                >
                  Générer un fond (IA)
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                L’IA travaille sur le fond : tes textes restent nets et modifiables par-dessus.
              </Typography>

              <Typography variant="subtitle2" color="text.secondary">
                Menu — à partir des vraies photos
              </Typography>
              <Autocomplete
                multiple
                size="small"
                options={articles}
                getOptionLabel={(a) => `${a.code} — ${a.name}${a.photoFile ? '' : ' (sans photo)'}`}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={menuArticles}
                onChange={(_, v) => setMenuArticles(v)}
                renderInput={(params) => <TextField {...params} label="Articles du menu" />}
              />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={() => menuFileRef.current?.click()}>
                  Ajouter des photos
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={aiBusy === 'compose' ? <CircularProgress size={14} color="inherit" /> : <RestaurantMenuIcon />}
                  onClick={() => void composeMenu()}
                  disabled={aiBusy !== null}
                >
                  Composer l’affiche (IA)
                </Button>
              </Stack>
              {menuFiles.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  {menuFiles.map((f, i) => (
                    <Chip
                      key={`${f.name}-${i}`}
                      label={f.name}
                      size="small"
                      onDelete={() => setMenuFiles((list) => list.filter((_, j) => j !== i))}
                    />
                  ))}
                </Stack>
              )}
              <input
                ref={menuFileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? [])
                  e.target.value = ''
                  if (list.length) setMenuFiles((prev) => [...prev, ...list].slice(0, 8))
                }}
              />

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Voile sombre (lisibilité) — {Math.round(veil * 100)}%
                </Typography>
                <Slider value={veil} onChange={(_, v) => setVeil(Array.isArray(v) ? v[0] : v)} min={0} max={0.8} step={0.05} size="small" />
              </Box>

              <ToggleButtonGroup
                size="small"
                exclusive
                value={showLogo ? 'on' : 'off'}
                onChange={(_, v) => v && setShowLogo(v === 'on')}
              >
                <ToggleButton value="on">Logo affiché</ToggleButton>
                <ToggleButton value="off">Sans logo</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </>
  )
}
