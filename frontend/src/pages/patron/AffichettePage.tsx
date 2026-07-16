import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
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
  ListItemIcon,
  Menu,
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
import DownloadIcon from '@mui/icons-material/Download'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import SaveIcon from '@mui/icons-material/Save'
import DeleteIcon from '@mui/icons-material/Delete'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FlipToFrontIcon from '@mui/icons-material/FlipToFront'
import SendIcon from '@mui/icons-material/Send'
import { errorMessage } from '../../api/client'
import { getProfile, getSettings, logoUrl } from '../../api/billing'
import { listArticles, photoUrl } from '../../api/costing'
import { composeImages, enhanceImage } from '../../api/insights'
import { generateImageFromPrompt, getCommunication, saveCommunication } from '../../api/communication'
import type { Article } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { buildPosterPdfBlob } from '../../pdf/buildPosterPdf'

type Fmt = 'square' | 'story' | 'facebook' | 'a4' | 'a5'
// Déclinaisons : réseaux (carré/story/facebook) + impression (A4/A5). Les textes sont en % → ils se
// ré-agencent automatiquement à chaque ratio. `ar` = ratio donné à l'IA pour cadrer le fond ;
// `size`/`print` = uniquement pour l'export PDF (formats imprimables).
const FORMATS: Record<
  Fmt,
  { w: number; h: number; label: string; ar: string; size?: 'A4' | 'A5'; print?: boolean }
> = {
  square: { w: 1080, h: 1080, label: 'Carré', ar: '1:1' },
  story: { w: 1080, h: 1920, label: 'Story', ar: '9:16' },
  facebook: { w: 1080, h: 1350, label: 'Facebook', ar: '4:5' },
  a4: { w: 1240, h: 1754, label: 'A4', ar: '3:4', size: 'A4', print: true },
  a5: { w: 874, h: 1240, label: 'A5', ar: '3:4', size: 'A5', print: true },
}
type BgMode = 'photo' | 'brand' | 'solid'
type Align = 'left' | 'center' | 'right'

// Ambiances / styles de fond proposés à l'IA (aides cliquables).
const AMBIANCES = [
  'Laisser l’IA choisir',
  'Fond ardoise élégant',
  'Planche en bois rustique',
  'Fond clair épuré (studio)',
  'Table dressée lifestyle',
  'Marché / étal gourmand',
  "Fond aux couleurs de l'enseigne",
]

// Aides « occasion » : ajoutent une intention au brief IA.
const OCCASIONS: { label: string; text: string }[] = [
  { label: 'Nouveauté', text: 'annonce une NOUVEAUTÉ' },
  { label: 'Promo', text: 'met en avant une PROMOTION' },
  { label: 'Offre du moment', text: 'offre du moment / édition limitée' },
  { label: 'Fête / Noël', text: 'ambiance festive de fin d’année (Noël)' },
  { label: 'Été / fraîcheur', text: 'ambiance estivale et fraîcheur' },
]

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

// Affiches réouvrables : on stocke l'ÉTAT ÉDITABLE (fond BRUT en dataURL + blocs + réglages),
// jamais l'image aplatie avec voile — sinon le voile se cumulerait à chaque réouverture.
const AFFICHES_KEY = 'argeneo.affiches'
interface SavedAffiche {
  id: string
  /** Id de la communication liée (pour rouvrir depuis la galerie via ?edit=). */
  commId: number | null
  name: string
  savedAt: number
  format: Fmt
  blocks: Block[]
  veil: number
  showLogo: boolean
  colors: { c1: string; c2: string }
  bgDataUrl: string | null
}
function loadAffiches(): SavedAffiche[] {
  try {
    const raw = JSON.parse(localStorage.getItem(AFFICHES_KEY) ?? '[]')
    return Array.isArray(raw) ? (raw as SavedAffiche[]) : []
  } catch {
    return []
  }
}

// Appui long (tactile) : durée avant déclenchement et tolérance de mouvement (au-delà = glissement).
const LONG_PRESS_MS = 450
const MOVE_CANCEL_PX = 8

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
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, zoom = 1) {
  // `zoom` (≥ 1) agrandit la photo autour du centre — identique au transform:scale de l'aperçu CSS.
  const r = Math.max(w / img.width, h / img.height) * zoom
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

/** Blocs d'une affichette vierge (titre + accroche) — état de départ et « Réinitialiser ». */
function defaultBlocks(): Block[] {
  return [
    newBlock({ text: 'Votre titre', yPct: 0.62, fontPct: 0.09, align: 'left', xPct: 0.06, wPct: 0.88 }),
    newBlock({ text: 'Votre accroche ici', yPct: 0.78, fontPct: 0.045, align: 'left', xPct: 0.06, wPct: 0.88, bold: false }),
  ]
}

/**
 * Éditeur d'affichette « type Canva » : des blocs de texte déplaçables/redimensionnables à la
 * souris par-dessus un fond (photo ou couleurs de l'enseigne). Export PNG/PDF (A4/A5) + sauvegarde.
 */
export function AffichettePage() {
  const stageRef = useRef<HTMLDivElement | null>(null)

  const [format, setFormat] = useState<Fmt>('a4')
  const [blocks, setBlocks] = useState<Block[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
      if (raw && Array.isArray(raw.blocks)) return raw.blocks as Block[]
    } catch {
      // pas de brouillon
    }
    return defaultBlocks()
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Édition de texte directement sur le canevas (double-clic) : id en cours d'édition + refs des spans.
  const [editingId, setEditingId] = useState<string | null>(null)
  const editRefs = useRef<Record<string, HTMLElement | null>>({})
  // Menu contextuel (appui long / clic droit sur un bloc) : position écran + bloc visé.
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null)

  const [bgMode, setBgMode] = useState<BgMode>('brand')
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null)
  const [solid, setSolid] = useState('#c2410c')
  const [bgZoom, setBgZoom] = useState(1) // zoom de la photo de fond (1 = plein cadre)
  const [veil, setVeil] = useState(0.35)
  const [colors, setColors] = useState({ c1: '#c2410c', c2: '#9a5417' })
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  const [showLogo, setShowLogo] = useState(true)

  const [articles, setArticles] = useState<Article[]>([])
  const [articleId, setArticleId] = useState<number | ''>('')

  // Parcours guidé : type d'affiche (1 produit ou menu) + garde-fou anti-doublon des textes.
  const [affType, setAffType] = useState<'produit' | 'menu'>('produit')
  const [seededProducts, setSeededProducts] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState<null | 'retouch' | 'generate' | 'compose' | 'chat'>(null)
  // Ambiance du fond généré (presets « comme dans Communication »).
  const [ambiance, setAmbiance] = useState(AMBIANCES[0])
  // Journal du chat IA (brief initial + affinages successifs).
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [menuArticles, setMenuArticles] = useState<Article[]>([])
  const [menuFiles, setMenuFiles] = useState<File[]>([])
  const menuFileRef = useRef<HTMLInputElement | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  // Affiches réouvrables (état éditable local).
  const [savedAffiches, setSavedAffiches] = useState<SavedAffiche[]>(() => loadAffiches())
  const [searchParams, setSearchParams] = useSearchParams()

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

  // Ouverture en édition depuis la galerie Communication (?edit=<commId>).
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId) return
    setSearchParams({}, { replace: true }) // évite de rouvrir à chaque rerender
    const id = Number(editId)
    void (async () => {
      // 1) Serveur (universel, multi-appareils)
      try {
        const detail = await getCommunication(id)
        if (detail.afficheState) {
          restoreState(JSON.parse(detail.afficheState))
          setSavedMsg('Affiche ouverte en édition.')
          return
        }
      } catch {
        // on retombe sur le cache local
      }
      // 2) Cache local (même appareil)
      const a = savedAffiches.find((x) => x.commId === id)
      if (a) reopenAffiche(a)
      else setSavedMsg('Cette affiche n’a pas d’état éditable (créée avant la mise à jour).')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Entrée en édition inline : place le texte courant dans le span et met le curseur à la fin.
  useEffect(() => {
    if (!editingId) return
    const el = editRefs.current[editingId]
    if (!el) return
    el.textContent = blocks.find((b) => b.id === editingId)?.text ?? ''
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

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
  // Ajoute un texte centré sur un point (fractions 0..1) — utilisé par l'appui long sur le canva.
  const addBlockAt = (xPct: number, yPct: number) => {
    const wPct = 0.8
    const b = newBlock({ text: 'Nouveau texte', wPct, xPct: clamp01(xPct - wPct / 2), yPct: clamp01(yPct - 0.03) })
    setBlocks((list) => [...list, b])
    setSelectedId(b.id)
  }
  const duplicateBlock = (id: string) => {
    const src = blocks.find((b) => b.id === id)
    if (!src) return
    const copy: Block = { ...src, id: newId(), xPct: clamp01(src.xPct + 0.04), yPct: clamp01(src.yPct + 0.04) }
    setBlocks((list) => [...list, copy])
    setSelectedId(copy.id)
  }
  // Passe le bloc au premier plan (dernier dans l'ordre de rendu).
  const bringToFront = (id: string) =>
    setBlocks((list) => {
      const b = list.find((x) => x.id === id)
      return b ? [...list.filter((x) => x.id !== id), b] : list
    })
  // Réinitialise l'affichette (efface les textes en cours, revient au titre + accroche).
  const resetCanvas = () => {
    setBlocks(defaultBlocks())
    setSelectedId(null)
    setMenu(null)
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
  // Timer d'appui long sur un bloc (ouvre le menu contextuel s'il n'y a pas de glissement).
  const blockLongPress = useRef<number | null>(null)
  const clearBlockLongPress = () => {
    if (blockLongPress.current != null) {
      clearTimeout(blockLongPress.current)
      blockLongPress.current = null
    }
  }

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
    // Appui long sur le corps du bloc → menu contextuel (annulé dès qu'un glissement commence).
    if (mode === 'move') {
      const px = e.clientX
      const py = e.clientY
      clearBlockLongPress()
      blockLongPress.current = window.setTimeout(() => {
        drag.current = null
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        blockLongPress.current = null
        setMenu({ x: px, y: py, id })
      }, LONG_PRESS_MS)
    }
  }
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    // Dès qu'on bouge assez, c'est un glissement : on annule l'appui long.
    if (blockLongPress.current != null && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > MOVE_CANCEL_PX) {
      clearBlockLongPress()
    }
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
    clearBlockLongPress()
    drag.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }
  useEffect(() => () => onPointerUp(), [])

  // --- Appui long sur le canva vide → ajouter un texte à cet endroit ---
  const stagePress = useRef<{ x: number; y: number; timer: number } | null>(null)
  const clearStagePress = () => {
    if (stagePress.current != null) {
      clearTimeout(stagePress.current.timer)
      stagePress.current = null
    }
  }
  const onStagePointerDown = (e: ReactPointerEvent) => {
    // Un simple appui désélectionne ; un appui maintenu (sans glisser) ajoute un texte.
    setSelectedId(null)
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const px = e.clientX
    const py = e.clientY
    clearStagePress()
    const timer = window.setTimeout(() => {
      addBlockAt(clamp01((px - rect.left) / rect.width), clamp01((py - rect.top) / rect.height))
      stagePress.current = null
    }, LONG_PRESS_MS)
    stagePress.current = { x: px, y: py, timer }
  }
  const onStagePointerMove = (e: ReactPointerEvent) => {
    const s = stagePress.current
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_CANCEL_PX) clearStagePress()
  }

  // --- IA : brief → affiche ---
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

  /** Traduit l'ambiance choisie en consigne pour l'IA (couleurs de l'enseigne, ardoise, bois…). */
  const ambiancePrompt = (): string | undefined => {
    if (ambiance.startsWith('Laisser')) return undefined
    if (ambiance.toLowerCase().includes('enseigne')) {
      return `fond uni ou dégradé harmonieux aux couleurs de l'enseigne : ${colors.c1} et ${colors.c2}`
    }
    return ambiance
  }

  /** Ajoute une intention (occasion) au brief IA, sans doublon. */
  const addBrief = (text: string) => {
    setAiPrompt((p) => (p.includes(text) ? p : (p.trim() ? p.trim() + '. ' : '') + text))
  }

  /** Produits actuellement ciblés selon le type d'affiche (1 produit ou menu). */
  const selectedProducts = (): Article[] =>
    affType === 'menu'
      ? menuArticles
      : articleId !== ''
        ? articles.filter((a) => a.id === articleId)
        : []

  /** Pré-remplit les textes nom + prix des produits (une seule fois, éditables ensuite). */
  const seedProductBlocks = (products: Article[]) => {
    if (products.length === 0 || seededProducts) return
    setSeededProducts(true)
    const eur = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
    if (affType === 'produit') {
      const a = products[0]
      const title = newBlock({ text: a.name, yPct: 0.6, fontPct: 0.09, align: 'left', xPct: 0.06, wPct: 0.88 })
      const price =
        a.salePriceTtc != null
          ? [newBlock({ text: eur(a.salePriceTtc), yPct: 0.85, xPct: 0.6, wPct: 0.34, fontPct: 0.07, align: 'center', bg: colors.c2 })]
          : []
      setBlocks((list) => [...list, title, ...price])
      setSelectedId(title.id)
    } else {
      const lines = products.map((a) => (a.salePriceTtc != null ? `${a.name} — ${eur(a.salePriceTtc)}` : a.name)).join('\n')
      const b = newBlock({ text: lines, yPct: 0.5, xPct: 0.08, wPct: 0.84, fontPct: 0.04, align: 'left' })
      setBlocks((list) => [...list, b])
      setSelectedId(b.id)
    }
  }

  /**
   * Crée l'affiche : met en scène les VRAIES photos des produits choisis (ou des photos importées)
   * via l'IA, ou génère un visuel de zéro si aucune photo. Puis pré-remplit les textes nom + prix.
   */
  const createAffiche = async () => {
    const products = selectedProducts()
    if (products.length === 0 && menuFiles.length === 0 && !aiPrompt.trim()) {
      setError('Choisis au moins un produit (ou importe une photo), puis décris ton affiche.')
      return
    }
    const brief = aiPrompt.trim()
    setError(null)
    if (brief) setChatLog((l) => [...l, { role: 'user', text: brief }])
    setAiBusy('compose')
    try {
      const files: File[] = [...menuFiles]
      for (const a of products) {
        if (!a.photoFile) continue
        const u = photoUrl(a.photoFile)
        if (!u) continue
        const r = await fetch(u)
        if (!r.ok) continue
        const blob = await r.blob()
        files.push(new File([blob], `produit-${a.id}.png`, { type: blob.type || 'image/png' }))
      }
      const instruction = [brief, ambiancePrompt()].filter(Boolean).join('. ')
      const blob =
        files.length > 0
          ? await composeImages(files, instruction || undefined, fmt.ar)
          : await generateImageFromPrompt(instruction || 'affiche promotionnelle appétissante', fmt.ar)
      setBgImg(await imgFromBlob(blob))
      setBgMode('photo')
      setBgZoom(1)
      seedProductBlocks(products)
      setChatLog((l) => [...l, { role: 'ai', text: 'Affiche créée ✅' }])
      setAiPrompt('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setAiBusy(null)
    }
  }

  /** Mini-chat IA : affine le fond au fil des messages (retouche image→image, ou génère si pas de fond). */
  const sendChat = async () => {
    const msg = aiPrompt.trim()
    if (!msg) return
    setError(null)
    setAiPrompt('')
    setChatLog((l) => [...l, { role: 'user', text: msg }])
    setAiBusy('chat')
    try {
      let blob: Blob
      if (bgMode === 'photo' && bgImg) {
        const f = await bgToFile()
        if (!f) throw new Error('Fond illisible')
        // Retouche image->image : ambiance via le paramètre dédié, message en instruction, ratio A5 conservé.
        blob = await enhanceImage(f, ambiancePrompt(), msg, 'scene', fmt.ar)
      } else {
        // Génération pure : pas de paramètre ambiance côté API, on le fond dans le prompt.
        const prompt = [msg, ambiancePrompt()].filter(Boolean).join('. ')
        blob = await generateImageFromPrompt(prompt, fmt.ar)
        setBgZoom(1)
      }
      setBgImg(await imgFromBlob(blob))
      setBgMode('photo')
      setChatLog((l) => [...l, { role: 'ai', text: 'Fond mis à jour ✅' }])
    } catch (e) {
      const m = errorMessage(e)
      setChatLog((l) => [...l, { role: 'ai', text: `⚠️ ${m}` }])
      setError(m)
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
      drawCover(ctx, bgImg, w, h, bgZoom)
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
    if (!fmt.size) return // PDF réservé aux formats imprimables (A4/A5)
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
  /** Le fond BRUT (sans voile/texte) en dataURL, pour pouvoir rouvrir l'affiche sans cumuler le voile. */
  const bgToDataUrl = (): string | null => {
    if (!bgImg) return null
    const c = document.createElement('canvas')
    c.width = bgImg.naturalWidth || bgImg.width
    c.height = bgImg.naturalHeight || bgImg.height
    c.getContext('2d')!.drawImage(bgImg, 0, 0)
    try {
      return c.toDataURL('image/png')
    } catch {
      return null
    }
  }

  /** Enregistre l'état ÉDITABLE (fond brut + blocs + réglages) pour réouverture ultérieure. */
  const persistEditable = (name: string, commId: number | null) => {
    const entry: SavedAffiche = {
      id: newId(),
      commId,
      name,
      savedAt: Date.now(),
      format,
      blocks,
      veil,
      showLogo,
      colors,
      bgDataUrl: bgToDataUrl(),
    }
    // On garde les 6 dernières (le fond en dataURL est lourd → quota localStorage).
    // On dédoublonne par communication (réenregistrer la même affiche remplace l'ancienne).
    let next = [entry, ...savedAffiches.filter((a) => a.commId == null || a.commId !== commId)].slice(0, 6)
    while (next.length > 0) {
      try {
        localStorage.setItem(AFFICHES_KEY, JSON.stringify(next))
        break
      } catch {
        next = next.slice(0, next.length - 1) // quota dépassé : on retire la plus ancienne
      }
    }
    setSavedAffiches(next)
  }

  /** Restaure un état éditable (fond BRUT + blocs + réglages) — commun au cache local et au serveur. */
  const restoreState = (s: {
    format?: Fmt
    blocks?: Block[]
    veil?: number
    showLogo?: boolean
    colors?: { c1: string; c2: string }
    bgDataUrl?: string | null
  }) => {
    setEditingId(null)
    setSelectedId(null)
    setChatLog([])
    if (s.format && s.format in FORMATS) setFormat(s.format)
    if (Array.isArray(s.blocks)) setBlocks(s.blocks)
    if (typeof s.veil === 'number') setVeil(s.veil)
    if (typeof s.showLogo === 'boolean') setShowLogo(s.showLogo)
    if (s.colors && s.colors.c1 && s.colors.c2) setColors(s.colors)
    if (s.bgDataUrl) {
      const img = new Image()
      img.onload = () => {
        setBgImg(img)
        setBgMode('photo')
        setBgZoom(1)
      }
      img.src = s.bgDataUrl
    } else {
      setBgImg(null)
      setBgMode('brand')
    }
  }

  /** Rouvre une affiche du cache LOCAL. */
  const reopenAffiche = (a: SavedAffiche) => {
    restoreState(a)
    setSavedMsg(`Affiche « ${a.name} » rouverte.`)
  }

  const save = async () => {
    setError(null)
    setSavedMsg(null)
    setSaving(true)
    try {
      const blob = await canvasToBlob(renderToCanvas())
      const headline = blocks[0]?.text?.slice(0, 200) || 'Affichette'
      // État éditable (fond BRUT + blocs + réglages) envoyé AU SERVEUR → édition depuis n'importe où.
      const afficheState = JSON.stringify({
        v: 1,
        format,
        blocks,
        veil,
        showLogo,
        colors,
        bgDataUrl: bgToDataUrl(),
      })
      const saved = await saveCommunication(
        {
          headline,
          articleId: articleId === '' ? null : articleId,
          platform: `Affichette ${fmt.label}`,
          afficheState,
        },
        blob,
      )
      // Cache local aussi (réouverture hors-ligne / rapide via le déroulant).
      persistEditable(headline, saved.id)
      setSavedMsg('Affichette enregistrée (et réouvrable pour édition).')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // Fond CSS de l'aperçu (miroir du rendu canvas). La photo est rendue dans un calque à part
  // (zoomable via transform:scale) ; les fonds uni/enseigne restent directement sur la scène.
  const stageBg =
    bgMode === 'solid'
      ? { background: solid }
      : bgMode === 'brand'
        ? { background: `linear-gradient(${colors.c1}, ${colors.c2})` }
        : {}

  return (
    <>
      <PageHeader
        title="Affichette"
        subtitle="Compose ton visuel puis décline-le pour Instagram, Facebook, story ou l’impression A4/A5 : textes déplaçables, fond IA, export PNG/PDF."
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
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" startIcon={<AddIcon />} onClick={addBlock}>
                  Ajouter un texte
                </Button>
                <Button size="small" color="inherit" startIcon={<RestartAltIcon />} onClick={resetCanvas}>
                  Réinitialiser
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1, p: 1 }}>
              <Box
                ref={stageRef}
                onPointerDown={onStagePointerDown}
                onPointerMove={onStagePointerMove}
                onPointerUp={clearStagePress}
                onPointerLeave={clearStagePress}
                onContextMenu={(e) => e.preventDefault()}
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
                {/* Calque photo (zoomable) */}
                {bgMode === 'photo' && bgImg && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: `url(${bgImg.src})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      transform: `scale(${bgZoom})`,
                      transformOrigin: 'center',
                      pointerEvents: 'none',
                    }}
                  />
                )}
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
                      onPointerDown={(e) => {
                        if (editingId === b.id) return // en cours d'édition : on laisse taper, pas de glissement
                        onPointerDown(e, b.id, 'move')
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setSelectedId(b.id)
                        setEditingId(b.id)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedId(b.id)
                        setMenu({ x: e.clientX, y: e.clientY, id: b.id })
                      }}
                      sx={{
                        position: 'absolute',
                        left: `${b.xPct * 100}%`,
                        top: `${b.yPct * 100}%`,
                        width: `${b.wPct * 100}%`,
                        textAlign: b.align,
                        cursor: editingId === b.id ? 'text' : 'move',
                        outline: isSel ? '1.5px dashed rgba(255,255,255,0.9)' : 'none',
                        outlineOffset: 2,
                      }}
                    >
                      <Box
                        component="span"
                        ref={(el: HTMLElement | null) => {
                          editRefs.current[b.id] = el
                        }}
                        contentEditable={editingId === b.id}
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          if (editingId !== b.id) return
                          updateBlock(b.id, { text: e.currentTarget.textContent ?? '' })
                          setEditingId(null)
                        }}
                        onKeyDown={(e) => {
                          if (editingId === b.id && e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            ;(e.currentTarget as HTMLElement).blur()
                          }
                        }}
                        sx={{
                          display: 'inline-block',
                          maxWidth: '100%',
                          color: b.color,
                          fontFamily: b.font ?? FONT,
                          fontWeight: b.bold ? 700 : 400,
                          lineHeight: 1.2,
                          whiteSpace: 'pre-wrap',
                          outline: 'none',
                          cursor: editingId === b.id ? 'text' : 'inherit',
                          ...(b.bg
                            ? { bgcolor: b.bg, borderRadius: 1, px: 0.6, py: 0.2 }
                            : {}),
                        }}
                        style={{ fontSize: `${b.fontPct * 100}cqw` }}
                      >
                        {editingId === b.id ? undefined : b.text || ' '}
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
              {fmt.print && (
                <Button
                  variant="contained"
                  startIcon={pdfBusy ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
                  onClick={() => void downloadPdf()}
                  disabled={pdfBusy}
                >
                  PDF
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Panneau de réglages */}
        <Card>
          <CardContent>
            <Stack spacing={2}>
              {/* 1 · Type d'affiche */}
              <Typography variant="subtitle2" color="text.secondary">
                1 · Que veux-tu mettre en avant ?
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                fullWidth
                value={affType}
                onChange={(_, v: 'produit' | 'menu' | null) => {
                  if (!v) return
                  setAffType(v)
                  setSeededProducts(false)
                }}
              >
                <ToggleButton value="produit">Un produit</ToggleButton>
                <ToggleButton value="menu">Un menu (plusieurs)</ToggleButton>
              </ToggleButtonGroup>

              <Divider />

              {/* 2 · Choix des produits */}
              <Typography variant="subtitle2" color="text.secondary">
                2 · {affType === 'menu' ? 'Choisis les produits' : 'Choisis le produit'}
              </Typography>
              {affType === 'produit' ? (
                <TextField
                  select
                  size="small"
                  label="Produit"
                  value={articleId === '' ? '' : String(articleId)}
                  onChange={(e) => {
                    setArticleId(e.target.value === '' ? '' : Number(e.target.value))
                    setSeededProducts(false)
                  }}
                >
                  <MenuItem value="">
                    <em>— Choisir —</em>
                  </MenuItem>
                  {articles.map((a) => (
                    <MenuItem key={a.id} value={String(a.id)}>
                      {a.code} — {a.name}
                      {a.photoFile ? '' : ' (sans photo)'}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <Autocomplete
                  multiple
                  size="small"
                  options={articles}
                  getOptionLabel={(a) => `${a.code} — ${a.name}${a.photoFile ? '' : ' (sans photo)'}`}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={menuArticles}
                  onChange={(_, v) => {
                    setMenuArticles(v)
                    setSeededProducts(false)
                  }}
                  renderInput={(params) => <TextField {...params} label="Produits du menu" />}
                />
              )}
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                <Button size="small" variant="text" startIcon={<UploadIcon />} onClick={() => menuFileRef.current?.click()}>
                  Importer des photos
                </Button>
                {menuFiles.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {menuFiles.length} photo(s)
                  </Typography>
                )}
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

              {/* 3 · Décris ton affiche à l'IA (chat) */}
              <Typography variant="subtitle2" color="text.secondary">
                3 · Décris ton affiche à l’IA
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Occasion :
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {OCCASIONS.map((o) => (
                  <Chip key={o.label} label={o.label} size="small" variant="outlined" onClick={() => addBrief(o.text)} />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Style de fond :
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {AMBIANCES.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    size="small"
                    color={ambiance === a ? 'primary' : 'default'}
                    variant={ambiance === a ? 'filled' : 'outlined'}
                    onClick={() => setAmbiance(a)}
                  />
                ))}
              </Stack>
              {chatLog.length > 0 && (
                <Box sx={{ maxHeight: 160, overflowY: 'auto', bgcolor: 'action.hover', borderRadius: 1, p: 1 }}>
                  <Stack spacing={0.5}>
                    {chatLog.map((m, i) => (
                      <Typography
                        key={i}
                        variant="caption"
                        sx={{
                          textAlign: m.role === 'user' ? 'right' : 'left',
                          color: m.role === 'user' ? 'text.primary' : 'primary.main',
                        }}
                      >
                        {m.role === 'user' ? `🧑 ${m.text}` : `🤖 ${m.text}`}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  maxRows={4}
                  placeholder={
                    bgImg
                      ? 'Affine : plus chaleureux, grossis le prix, ajoute des guirlandes…'
                      : 'Décris ton affiche : appétissant, met en valeur le produit…'
                  }
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (bgImg) void sendChat()
                      else void createAffiche()
                    }
                  }}
                  disabled={aiBusy !== null}
                />
                <Button
                  variant="contained"
                  onClick={() => {
                    if (bgImg) void sendChat()
                    else void createAffiche()
                  }}
                  disabled={aiBusy !== null}
                  startIcon={
                    aiBusy !== null ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : bgImg ? (
                      <SendIcon />
                    ) : (
                      <AutoAwesomeIcon />
                    )
                  }
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {bgImg ? 'Envoyer' : 'Créer'}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {bgImg
                  ? 'Chaque message affine l’affiche ; tes textes restent nets par-dessus.'
                  : 'Décris (ou clique les aides), puis « Créer ».'}
              </Typography>

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

              <Divider />

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
                  Clique un texte sur l’affichette pour le modifier, ou « Ajouter un texte ». Appui long
                  sur le fond : ajoute un texte ; appui long (ou clic droit) sur un texte : menu
                  (dupliquer, supprimer…). Touche Suppr : efface le texte sélectionné. Poignée d’angle :
                  agrandit zone et police.
                </Typography>
              )}

              {savedAffiches.length > 0 && (
                <>
                  <Divider />
                  <TextField
                    select
                    size="small"
                    label="Rouvrir une affiche enregistrée"
                    value=""
                    onChange={(e) => {
                      const a = savedAffiches.find((x) => x.id === e.target.value)
                      if (a) reopenAffiche(a)
                    }}
                  >
                    {savedAffiches.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.name || 'Affiche'}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Menu contextuel d'un bloc (appui long tactile ou clic droit). */}
      <Menu
        open={menu != null}
        onClose={() => setMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
      >
        <MenuItem
          onClick={() => {
            if (menu) duplicateBlock(menu.id)
            setMenu(null)
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          Dupliquer
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) bringToFront(menu.id)
            setMenu(null)
          }}
        >
          <ListItemIcon>
            <FlipToFrontIcon fontSize="small" />
          </ListItemIcon>
          Mettre au premier plan
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (menu) removeBlock(menu.id)
            setMenu(null)
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          Supprimer
        </MenuItem>
      </Menu>
    </>
  )
}
