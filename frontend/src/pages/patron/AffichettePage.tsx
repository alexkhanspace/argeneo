import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  AppBar,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Slider,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import UploadIcon from '@mui/icons-material/Upload'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import DownloadIcon from '@mui/icons-material/Download'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import SaveIcon from '@mui/icons-material/Save'
import DeleteIcon from '@mui/icons-material/Delete'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FlipToFrontIcon from '@mui/icons-material/FlipToFront'
import CloseIcon from '@mui/icons-material/Close'
import PhotoCamera from '@mui/icons-material/PhotoCamera'
import ImageIcon from '@mui/icons-material/Image'
import InventoryIcon from '@mui/icons-material/Inventory2'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import EditIcon from '@mui/icons-material/Edit'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import FlipIcon from '@mui/icons-material/Flip'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import { errorMessage } from '../../api/client'
import { getProfile, getSettings, logoUrl } from '../../api/billing'
import { listArticles, photoUrl } from '../../api/costing'
import { composeImages, getAdSlogans } from '../../api/insights'
import {
  deleteCommunication,
  generateSocialPost,
  getCommunication,
  listCommunications,
  saveCommunication,
  type CommunicationSummary,
} from '../../api/communication'
import { listMyEtablissements } from '../../api/daily'
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

// Étapes de l'assistant plein écran.
const WIZARD_STEPS = ['Source', 'Fond & IA', 'Textes', 'Export']

// Légende réseaux : réseau ciblé, ton et longueur du texte à publier.
const PLATFORMS = ['Instagram', 'Facebook']
const TONES = ['Chaleureux', 'Fier', 'Festif', 'Informatif', 'Gourmand']
const LENGTHS = [
  { value: 'court', label: 'Courte' },
  { value: 'moyen', label: 'Moyenne' },
  { value: 'long', label: 'Longue' },
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
  rot?: number // rotation du texte en degrés (défaut : 0)
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
  bgMode?: BgMode
  solid?: string
  bgRot?: number
  bgFlipH?: boolean
  bgZoom?: number
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
  const [bgRot, setBgRot] = useState(0) // rotation de la photo de fond (degrés)
  const [bgFlipH, setBgFlipH] = useState(false) // miroir horizontal de la photo
  const [imgSel, setImgSel] = useState(false) // photo sélectionnée sur le canevas (barre d'outils)
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
  const [menuArticles, setMenuArticles] = useState<Article[]>([])
  const [menuFiles, setMenuFiles] = useState<File[]>([])
  const menuFileRef = useRef<HTMLInputElement | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Légende réseaux (texte prêt à publier sous le visuel).
  const [platform, setPlatform] = useState('Instagram')
  const [tone, setTone] = useState('Chaleureux')
  const [length, setLength] = useState('moyen')
  const [caption, setCaption] = useState('')
  const [captionLoading, setCaptionLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [etab, setEtab] = useState<{ name?: string; description?: string | null; address?: string | null }>({})
  // Affiches réouvrables (état éditable local).
  const [savedAffiches, setSavedAffiches] = useState<SavedAffiche[]>(() => loadAffiches())
  // Communications archivées côté serveur (réouvrables depuis n'importe quel appareil).
  const [archives, setArchives] = useState<CommunicationSummary[]>([])
  const [searchParams, setSearchParams] = useSearchParams()

  // --- Assistant plein écran (parcours guidé) ---
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(0)
  // Source : catalogue (produit/menu), import fichier, ou prise de photo (appareil).
  const [srcMode, setSrcMode] = useState<'catalogue' | 'import' | 'photo'>('catalogue')
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  // Couleur du fond uni (étape 2), par défaut couleur de l'enseigne (renseignée au chargement charte).
  const [bgColor, setBgColor] = useState('#c2410c')
  // Guides d'alignement affichés pendant le déplacement d'un texte (fractions 0..1).
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  // Calques produit (photos importées détourées et/ou produit détouré par l'IA) posés sur la couleur.
  const layersRef = useRef<Array<HTMLImageElement | HTMLCanvasElement>>([])
  // Accroches proposées par l'IA (étape 3).
  const [aiSlogans, setAiSlogans] = useState<string[]>([])
  const [textBusy, setTextBusy] = useState(false)
  // Popup « détourer avec l'IA ? » après un import, au passage à l'étape Fond.
  const [detourAsk, setDetourAsk] = useState(false)

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId])
  const fmt = FORMATS[format]
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Chargement charte + produits + logo.
  useEffect(() => {
    listArticles().then(setArticles).catch(() => undefined)
    getSettings()
      .then((s) => {
        const c1 = safeColor(s.brandColor1, '#c2410c')
        const c2 = safeColor(s.brandColor2, c1)
        setColors({ c1, c2 })
        setSolid(c1)
        setBgColor(c1)
      })
      .catch(() => undefined)
    getProfile()
      .then((p) => loadImage(p.logoFile ? logoUrl(p.logoFile) : null).then(setLogoImg))
      .catch(() => undefined)
    listMyEtablissements()
      .then((etabs) => {
        const e = etabs[0]
        if (e) setEtab({ name: e.name, description: e.description, address: e.address })
      })
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

  // Ouverture en édition d'une communication archivée (serveur d'abord, cache local en secours).
  const openCommunication = async (id: number) => {
    // 1) Serveur (universel, multi-appareils)
    try {
      const detail = await getCommunication(id)
      if (detail.afficheState) {
        restoreState(JSON.parse(detail.afficheState))
        setSavedMsg('Affiche ouverte en édition.')
        setStep(2)
        setWizardOpen(true)
        return
      }
    } catch {
      // on retombe sur le cache local
    }
    // 2) Cache local (même appareil)
    const a = savedAffiches.find((x) => x.commId === id)
    if (a) {
      reopenAffiche(a)
      setStep(2)
      setWizardOpen(true)
    } else {
      setSavedMsg('Cette affiche n’a pas d’état éditable (créée avant la mise à jour).')
    }
  }

  /** Démarre une nouvelle affiche vierge et ouvre l'assistant à l'étape 1. */
  const startNewAffiche = () => {
    resetCanvas()
    setBgImg(null)
    setBgMode('brand')
    setBgZoom(1)
    setBgRot(0)
    setBgFlipH(false)
    setImgSel(false)
    setArticleId('')
    setMenuArticles([])
    setMenuFiles([])
    setAiPrompt('')
    setAiSlogans([])
    setSeededProducts(false)
    layersRef.current = []
    setSrcMode('catalogue')
    setStep(0)
    setError(null)
    setWizardOpen(true)
  }
  const nextStep = () => setStep((s) => Math.min(3, s + 1))
  const prevStep = () => setStep((s) => Math.max(0, s - 1))
  // « Suivant » : après un import (photo), on propose le détourage IA en arrivant à l'étape Fond.
  const handleNext = () => {
    const askDetour = step === 0 && menuFiles.length > 0 && bgMode === 'photo'
    nextStep()
    if (askDetour) setDetourAsk(true)
  }

  const refreshArchives = () => {
    listCommunications().then(setArchives).catch(() => undefined)
  }
  useEffect(() => {
    refreshArchives()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDeleteArchive = async (id: number) => {
    if (!window.confirm('Supprimer cette communication ?')) return
    try {
      await deleteCommunication(id)
      refreshArchives()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  // Ouverture en édition depuis la galerie Communication (?edit=<commId>).
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId) return
    setSearchParams({}, { replace: true }) // évite de rouvrir à chaque rerender
    void openCommunication(Number(editId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Arrivée depuis la fiche article (?article=<id>) : pré-sélectionne le produit à mettre en avant.
  useEffect(() => {
    const aid = searchParams.get('article')
    if (!aid || articles.length === 0) return
    const id = Number(aid)
    if (articles.some((a) => a.id === id)) {
      setAffType('produit')
      setArticleId(id)
      setSeededProducts(false)
      setSrcMode('catalogue')
      setStep(0)
      setWizardOpen(true)
    }
    searchParams.delete('article')
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles])

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
      // Aimantation + guides d'alignement : centre, marges gauche/droite, milieu vertical.
      const SNAP = 0.015
      let nx = clamp01(d.b.xPct + dx)
      let ny = clamp01(d.b.yPct + dy)
      const w = d.b.wPct
      const gv: number[] = []
      const gh: number[] = []
      const cx = nx + w / 2
      if (Math.abs(cx - 0.5) < SNAP) {
        nx = 0.5 - w / 2
        gv.push(0.5)
      } else if (Math.abs(nx - 0.06) < SNAP) {
        nx = 0.06
        gv.push(0.06)
      } else if (Math.abs(nx + w - 0.94) < SNAP) {
        nx = 0.94 - w
        gv.push(0.94)
      }
      if (Math.abs(ny - 0.5) < SNAP) {
        ny = 0.5
        gh.push(0.5)
      } else if (Math.abs(ny - 0.08) < SNAP) {
        ny = 0.08
        gh.push(0.08)
      }
      updateBlock(d.id, { xPct: nx, yPct: ny })
      setGuides({ v: gv, h: gh })
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
    setGuides({ v: [], h: [] })
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

  // --- Détourage IA + composition sur la couleur EXACTE de l'enseigne ---
  /**
   * Chroma-key AUTO : au lieu de supposer un magenta parfait (souvent mal rendu → rectangle résiduel),
   * on ÉCHANTILLONNE la couleur réelle du fond aux 4 coins (le produit est centré, les coins = fond)
   * et on rend transparents les pixels proches de cette couleur. Robuste quelle que soit la teinte
   * choisie par l'IA. Puis on pose le produit sur la couleur exacte de l'enseigne.
   */
  const chromaKeyAuto = (img: HTMLImageElement): HTMLCanvasElement => {
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const cx = c.getContext('2d')!
    cx.drawImage(img, 0, 0)
    try {
      const im = cx.getImageData(0, 0, w, h)
      const d = im.data
      // Couleur de fond = moyenne d'un petit carré à chaque coin.
      const s = Math.max(4, Math.round(Math.min(w, h) * 0.03))
      let br = 0
      let bg = 0
      let bb = 0
      let n = 0
      const corners = [
        [0, 0],
        [w - s, 0],
        [0, h - s],
        [w - s, h - s],
      ]
      for (const [ox, oy] of corners) {
        for (let y = 0; y < s; y++) {
          for (let x = 0; x < s; x++) {
            const idx = ((oy + y) * w + (ox + x)) * 4
            br += d[idx]
            bg += d[idx + 1]
            bb += d[idx + 2]
            n++
          }
        }
      }
      br /= n
      bg /= n
      bb /= n
      // Tolérance : plein transparent en deçà de IN, opaque au-delà de OUT (dégradé = bords nets).
      const IN = 42
      const OUT = 100
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.hypot(d[i] - br, d[i + 1] - bg, d[i + 2] - bb)
        if (dist <= IN) {
          d[i + 3] = 0
        } else if (dist < OUT) {
          d[i + 3] = Math.round(d[i + 3] * ((dist - IN) / (OUT - IN)))
        }
      }
      cx.putImageData(im, 0, 0)
    } catch {
      // blob same-origin : canvas jamais « taint »
    }
    return c
  }

  /** Dessine les produits (avec alpha) sur un aplat de la couleur choisie → canevas au format courant. */
  const composeOnColor = (layers: Array<HTMLImageElement | HTMLCanvasElement>, color: string): HTMLCanvasElement => {
    const { w, h } = fmt
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
    const pad = Math.round(w * 0.08)
    const ax = pad
    const ay = pad
    const aw = w - 2 * pad
    const ah = Math.round(h * 0.62)
    const draw = (img: HTMLImageElement | HTMLCanvasElement, x: number, y: number, bw: number, bh: number) => {
      const iw0 = img instanceof HTMLCanvasElement ? img.width : img.naturalWidth || img.width
      const ih0 = img instanceof HTMLCanvasElement ? img.height : img.naturalHeight || img.height
      const r = Math.min(bw / iw0, bh / ih0)
      ctx.drawImage(img, x + (bw - iw0 * r) / 2, y + (bh - ih0 * r) / 2, iw0 * r, ih0 * r)
    }
    if (layers.length === 1) {
      draw(layers[0], ax, ay, aw, ah)
    } else {
      const cols = Math.ceil(Math.sqrt(layers.length))
      const rows = Math.ceil(layers.length / cols)
      const cw = aw / cols
      const ch = ah / rows
      layers.forEach((img, i) => draw(img, ax + (i % cols) * cw, ay + Math.floor(i / cols) * ch, cw * 0.9, ch * 0.9))
    }
    return canvas
  }

  /** Recompose le fond : produits (layersRef) posés sur la couleur EXACTE (peinte par l'appli). */
  const applyLayers = async (color: string) => {
    const layers = layersRef.current
    if (layers.length === 0) {
      setBgImg(null)
      setSolid(color)
      setBgMode('solid')
      setBgZoom(1)
      return
    }
    const blob = await canvasToBlob(composeOnColor(layers, color))
    if (blob) {
      setBgImg(await imgFromBlob(blob))
      setBgMode('photo')
      setBgZoom(1)
    }
  }

  /** Import (ou photo) : les images s'affichent tout de suite, posées sur la couleur du fond. */
  const onImportFiles = async (list: File[]) => {
    if (!list.length) return
    setMenuFiles((prev) => [...prev, ...list].slice(0, 8))
    const imgs = await Promise.all(list.map((f) => imgFromBlob(f)))
    layersRef.current = [...layersRef.current, ...imgs].slice(0, 8)
    await applyLayers(bgColor)
  }

  /** Produit mis en avant (le 1er du menu le cas échéant) — sert de contexte à la légende. */
  const captionArticle = (): Article | null =>
    affType === 'menu' ? menuArticles[0] ?? null : articles.find((a) => a.id === articleId) ?? null

  /** Rédige la légende réseaux (texte prêt à publier) à partir du brief et/ou du produit ciblé. */
  const onGenerateCaption = async () => {
    const a = captionArticle()
    if (!aiPrompt.trim() && !a) {
      setError('Écris le sujet (étape Textes) ou choisis un produit pour rédiger la légende.')
      return
    }
    setError(null)
    setCaptionLoading(true)
    try {
      const res = await generateSocialPost({
        etablissement: etab.name ?? 'boulangerie',
        description: etab.description ?? null,
        location: etab.address ?? null,
        brief: aiPrompt.trim() || null,
        platform,
        tone,
        length,
        articleName: a?.name ?? null,
        articleDescription: a?.description ?? null,
        priceTtc: a?.salePriceTtc ?? null,
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

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Copie impossible — sélectionne le texte manuellement.')
    }
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

  /** Rassemble les fichiers sources : photos importées + photos des produits choisis. */
  const gatherFiles = async (products: Article[]): Promise<File[]> => {
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
    return files
  }

  /**
   * Détourage : l'IA isole le(s) produit(s) sur un fond MAGENTA pur, que l'appli retire (chroma-key)
   * pour poser le produit sur la couleur EXACTE de l'enseigne — la teinte n'est jamais peinte par l'IA.
   */
  const detourer = async () => {
    const products = selectedProducts()
    setError(null)
    setAiBusy('compose')
    try {
      const files = await gatherFiles(products)
      if (files.length === 0) {
        layersRef.current = []
        await applyLayers(bgColor)
        seedProductBlocks(products)
        setSavedMsg('Fond appliqué. Importe une photo (ou choisis un produit avec photo) puis « Détourer ».')
        return
      }
      // mode « isolate » : l'IA isole le produit sur un fond magenta pur (prompt dédié côté serveur).
      const raw = await imgFromBlob(await composeImages(files, undefined, fmt.ar, 'isolate'))
      layersRef.current = [chromaKeyAuto(raw)]
      await applyLayers(bgColor)
      seedProductBlocks(products)
      setSavedMsg('Produit détouré sur le fond de l’enseigne ✅')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setAiBusy(null)
    }
  }

  /** Ajoute un texte donné comme nouveau bloc, centré, et le sélectionne. */
  const addTextBlock = (text: string) => {
    const b = newBlock({ text, yPct: 0.5, xPct: 0.08, wPct: 0.84, fontPct: 0.06, align: 'center' })
    setBlocks((list) => [...list, b])
    setSelectedId(b.id)
  }

  /** Étape 3 : propose des accroches publicitaires via l'IA (sujet saisi et/ou produit ciblé). */
  const generateText = async () => {
    const a = captionArticle()
    const name = aiPrompt.trim() || a?.name
    if (!name) {
      setError('Écris le sujet de ton affiche (ou choisis un produit) pour générer une accroche.')
      return
    }
    setError(null)
    setTextBusy(true)
    try {
      const res = await getAdSlogans({
        etablissement: etab.name ?? 'boulangerie',
        description: etab.description ?? null,
        location: etab.address ?? null,
        articleName: name,
        articleDescription: a?.description ?? null,
        priceTtc: a?.salePriceTtc ?? null,
      })
      setAiSlogans(res.enabled ? res.slogans : [])
      if (!res.enabled) setError('Génération IA non disponible.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setTextBusy(false)
    }
  }

  // --- Rendu haute résolution (export) ---
  // `fmtKey` permet de rendre un autre format que celui affiché (export « toutes déclinaisons »).
  const renderToCanvas = (fmtKey: Fmt = format): HTMLCanvasElement => {
    const { w, h } = FORMATS[fmtKey]
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    // Fond
    if (bgMode === 'photo' && bgImg) {
      if (bgRot || bgFlipH) {
        ctx.save()
        ctx.translate(w / 2, h / 2)
        if (bgRot) ctx.rotate((bgRot * Math.PI) / 180)
        if (bgFlipH) ctx.scale(-1, 1)
        ctx.translate(-w / 2, -h / 2)
        drawCover(ctx, bgImg, w, h, bgZoom)
        ctx.restore()
      } else {
        drawCover(ctx, bgImg, w, h, bgZoom)
      }
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
      // Rotation du bloc autour de son centre (comme l'aperçu CSS transform:rotate).
      const rotated = !!b.rot
      if (rotated) {
        const cxr = x + maxW / 2
        const cyr = y + (lines.length * lineH) / 2
        ctx.save()
        ctx.translate(cxr, cyr)
        ctx.rotate(((b.rot as number) * Math.PI) / 180)
        ctx.translate(-cxr, -cyr)
      }
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
      if (rotated) ctx.restore()
    }
    return canvas
  }

  const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const downloadPng = async (fmtKey: Fmt = format) => {
    const blob = await canvasToBlob(renderToCanvas(fmtKey))
    if (blob) downloadBlob(blob, `affichette-${fmtKey}.png`)
  }
  const downloadPdf = async (fmtKey: Fmt = format) => {
    const size = FORMATS[fmtKey].size
    if (!size) return // PDF réservé aux formats imprimables (A4/A5)
    setError(null)
    setPdfBusy(true)
    try {
      const dataUrl = renderToCanvas(fmtKey).toDataURL('image/png')
      const blob = await buildPosterPdfBlob(dataUrl, size)
      downloadBlob(blob, `affichette-${fmtKey}.pdf`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPdfBusy(false)
    }
  }
  /** Exporte un PNG pour CHAQUE déclinaison (réseaux + impression). */
  const exportAllPng = async () => {
    for (const key of Object.keys(FORMATS) as Fmt[]) {
      const blob = await canvasToBlob(renderToCanvas(key))
      if (blob) downloadBlob(blob, `affichette-${key}.png`)
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
      bgMode,
      solid,
      bgRot,
      bgFlipH,
      bgZoom,
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
    bgMode?: BgMode
    solid?: string
    bgRot?: number
    bgFlipH?: boolean
    bgZoom?: number
    caption?: string
    socialPlatform?: string
    tone?: string
    length?: string
  }) => {
    setEditingId(null)
    setSelectedId(null)
    layersRef.current = []
    if (s.format && s.format in FORMATS) setFormat(s.format)
    if (Array.isArray(s.blocks)) setBlocks(s.blocks)
    if (typeof s.veil === 'number') setVeil(s.veil)
    if (typeof s.showLogo === 'boolean') setShowLogo(s.showLogo)
    if (s.colors && s.colors.c1 && s.colors.c2) setColors(s.colors)
    if (typeof s.caption === 'string') setCaption(s.caption)
    if (s.socialPlatform && PLATFORMS.includes(s.socialPlatform)) setPlatform(s.socialPlatform)
    if (s.tone) setTone(s.tone)
    if (s.length) setLength(s.length)
    if (typeof s.solid === 'string') setSolid(s.solid)
    setBgRot(typeof s.bgRot === 'number' ? s.bgRot : 0)
    setBgFlipH(!!s.bgFlipH)
    setImgSel(false)
    if (s.bgDataUrl) {
      const img = new Image()
      img.onload = () => {
        setBgImg(img)
        setBgMode('photo')
        setBgZoom(typeof s.bgZoom === 'number' ? s.bgZoom : 1)
      }
      img.src = s.bgDataUrl
    } else {
      // Fond sans photo : on restitue l'aplat (uni enseigne) ou le dégradé selon le mode enregistré.
      setBgImg(null)
      setBgMode(s.bgMode === 'solid' ? 'solid' : 'brand')
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
        bgMode,
        solid,
        bgRot,
        bgFlipH,
        bgZoom,
        caption,
        socialPlatform: platform,
        tone,
        length,
      })
      const saved = await saveCommunication(
        {
          headline,
          articleId: articleId === '' ? null : articleId,
          platform: `Affichette ${fmt.label}`,
          tone,
          length,
          caption: caption || null,
          afficheState,
        },
        blob,
      )
      // Cache local aussi (réouverture hors-ligne / rapide via le déroulant).
      persistEditable(headline, saved.id)
      refreshArchives()
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

  // Scène éditable (aperçu + manipulation des textes). Réutilisée dans plusieurs étapes.
  const renderStage = () => (
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
        {bgMode === 'photo' && bgImg && (
          <Box
            onPointerDown={(e) => {
              e.stopPropagation()
              setSelectedId(null)
              setImgSel(true)
            }}
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${bgImg.src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: `rotate(${bgRot}deg) scaleX(${bgFlipH ? -bgZoom : bgZoom}) scaleY(${bgZoom})`,
              transformOrigin: 'center',
              outline: imgSel ? '2px solid rgba(255,255,255,0.9)' : 'none',
              outlineOffset: -2,
              cursor: 'pointer',
            }}
          />
        )}
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
        {/* Guides d'alignement (pendant le déplacement) */}
        {guides.v.map((x, i) => (
          <Box
            key={`gv${i}`}
            sx={{ position: 'absolute', left: `${x * 100}%`, top: 0, bottom: 0, width: '1px', bgcolor: '#e11d9b', pointerEvents: 'none' }}
          />
        ))}
        {guides.h.map((y, i) => (
          <Box
            key={`gh${i}`}
            sx={{ position: 'absolute', top: `${y * 100}%`, left: 0, right: 0, height: '1px', bgcolor: '#e11d9b', pointerEvents: 'none' }}
          />
        ))}
        {blocks.map((b) => {
          const isSel = b.id === selectedId
          return (
            <Box
              key={b.id}
              onPointerDown={(e) => {
                if (editingId === b.id) return
                setImgSel(false)
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
                transform: b.rot ? `rotate(${b.rot}deg)` : undefined,
                transformOrigin: 'center',
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
                  ...(b.bg ? { bgcolor: b.bg, borderRadius: 1, px: 0.6, py: 0.2 } : {}),
                }}
                style={{ fontSize: `${b.fontPct * 100}cqw` }}
              >
                {editingId === b.id ? undefined : b.text || ' '}
              </Box>
              {isSel && (
                <>
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
        {/* Barre d'outils flottante quand la PHOTO est sélectionnée (clic sur l'image). */}
        {imgSel && bgMode === 'photo' && bgImg && (
          <Stack
            direction="row"
            spacing={0.5}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              position: 'absolute',
              top: 6,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(0,0,0,0.62)',
              borderRadius: 2,
              px: 0.5,
              py: 0.25,
              zIndex: 5,
              '& .MuiIconButton-root': { color: '#fff' },
            }}
          >
            <Tooltip title="Pivoter à gauche">
              <IconButton size="small" onClick={() => setBgRot((r) => r - 90)}>
                <RotateLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Pivoter à droite">
              <IconButton size="small" onClick={() => setBgRot((r) => r + 90)}>
                <RotateRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Miroir">
              <IconButton size="small" onClick={() => setBgFlipH((f) => !f)}>
                <FlipIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Agrandir">
              <IconButton size="small" onClick={() => setBgZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Réduire">
              <IconButton size="small" onClick={() => setBgZoom((z) => Math.max(1, +(z - 0.15).toFixed(2)))}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Réinitialiser">
              <IconButton
                size="small"
                onClick={() => {
                  setBgRot(0)
                  setBgZoom(1)
                  setBgFlipH(false)
                }}
              >
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fermer">
              <IconButton size="small" onClick={() => setImgSel(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>
    </Box>
  )

  // Panneau d'édition du texte sélectionné (police, taille, alignement, couleurs…).
  const renderBlockEditor = () =>
    selected ? (
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
        <Box>
          <Typography variant="caption" color="text.secondary">
            Rotation du texte ({Math.round(selected.rot ?? 0)}°)
          </Typography>
          <Slider
            value={selected.rot ?? 0}
            onChange={(_, v) => updateBlock(selected.id, { rot: Array.isArray(v) ? v[0] : v })}
            min={-180}
            max={180}
            step={1}
            marks={[{ value: 0 }]}
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
        Double-clique un texte sur l’affiche pour le modifier, glisse-le pour le déplacer (des repères
        roses apparaissent quand il est aligné). Poignée d’angle : agrandit zone et police.
      </Typography>
    )

  return (
    <>
      <PageHeader
        title="Communication"
        subtitle="Compose ton visuel puis décline-le pour Instagram, Facebook, story ou l’impression A4/A5 : textes déplaçables, fond IA, légende réseaux, export PNG/PDF."
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

      {/* Accueil : créer + galerie des communications enregistrées. */}
      <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={startNewAffiche} sx={{ mb: 2 }}>
        Créer une affiche
      </Button>

      {archives.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Mes affiches
            </Typography>
            <Stack divider={<Divider flexItem />} spacing={0}>
              {archives.map((c) => (
                <Stack key={c.id} direction="row" spacing={1} sx={{ py: 1, alignItems: 'center' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 500 }}>
                      {c.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.platform ?? '—'} · {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                    </Typography>
                  </Box>
                  {c.hasAfficheState && (
                    <Button size="small" startIcon={<EditIcon />} onClick={() => void openCommunication(c.id)}>
                      Éditer
                    </Button>
                  )}
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

      {/* Assistant plein écran (parcours guidé, responsive). */}
      <Dialog fullScreen open={wizardOpen} onClose={() => setWizardOpen(false)}>
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={() => setWizardOpen(false)} aria-label="Fermer">
              <CloseIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Créer une affiche
            </Typography>
          </Toolbar>
          {isMobile ? (
            <Box sx={{ px: 2, pb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Étape {step + 1}/{WIZARD_STEPS.length} · <strong>{WIZARD_STEPS[step]}</strong>
              </Typography>
            </Box>
          ) : (
            <Box sx={{ px: 2, pb: 1, overflowX: 'auto' }}>
              <Stepper activeStep={step}>
                {WIZARD_STEPS.map((label, i) => (
                  <Step key={label} completed={step > i}>
                    <StepLabel>
                      <Box component="span" onClick={() => setStep(i)} sx={{ cursor: 'pointer' }}>
                        {label}
                      </Box>
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>
          )}
        </AppBar>

        <Box sx={{ p: { xs: 2, md: 3 }, pb: 16, maxWidth: 1100, mx: 'auto', width: '100%' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* ÉTAPE 1 — Source */}
          {step === 0 && (
            <Stack spacing={2}>
              <Typography variant="h6">1 · Choisis ta source</Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={srcMode}
                onChange={(_, v: 'catalogue' | 'import' | 'photo' | null) => v && setSrcMode(v)}
                sx={{ flexWrap: 'wrap' }}
              >
                <ToggleButton value="catalogue">
                  <InventoryIcon sx={{ mr: 1 }} /> Produit du catalogue
                </ToggleButton>
                <ToggleButton value="import">
                  <ImageIcon sx={{ mr: 1 }} /> Importer une image
                </ToggleButton>
                <ToggleButton value="photo">
                  <PhotoCamera sx={{ mr: 1 }} /> Prendre une photo
                </ToggleButton>
              </ToggleButtonGroup>

              {srcMode === 'catalogue' && (
                <>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
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
                </>
              )}

              {srcMode === 'import' && (
                <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => menuFileRef.current?.click()} sx={{ alignSelf: 'flex-start' }}>
                  Importer une ou plusieurs images
                </Button>
              )}
              {srcMode === 'photo' && (
                <Button variant="outlined" startIcon={<PhotoCamera />} onClick={() => photoInputRef.current?.click()} sx={{ alignSelf: 'flex-start' }}>
                  Prendre une photo
                </Button>
              )}

              {menuFiles.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {menuFiles.map((f, i) => (
                    <Box key={`${f.name}-${i}`} sx={{ position: 'relative' }}>
                      <Box
                        component="img"
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        sx={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => setMenuFiles((list) => list.filter((_, j) => j !== i))}
                        sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper', boxShadow: 1 }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
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
                  void onImportFiles(list)
                }}
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? [])
                  e.target.value = ''
                  void onImportFiles(list)
                }}
              />
            </Stack>
          )}

          {/* ÉTAPE 2 — Fond aux couleurs de l'enseigne + détourage IA */}
          {step === 1 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' }, gap: 3 }}>
              {renderStage()}
              <Stack spacing={2}>
                <Typography variant="h6">2 · Fond & détourage</Typography>
                <Typography variant="caption" color="text.secondary">
                  Fond aux couleurs de l’enseigne (modifiable) :
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <TextField
                    type="color"
                    size="small"
                    label="Couleur du fond"
                    value={bgColor}
                    onChange={(e) => {
                      setBgColor(e.target.value)
                      if (layersRef.current.length) void applyLayers(e.target.value)
                    }}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ width: 120 }}
                  />
                </Stack>
                <Button
                  variant="contained"
                  startIcon={aiBusy !== null ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                  onClick={() => void detourer()}
                  disabled={aiBusy !== null}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Détourer le produit sur le fond
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Une photo détourée (PNG transparent) importée s’affiche directement sur la couleur. Sinon
                  « Détourer » isole le produit par IA et le pose sur la couleur exacte (jamais repeinte par
                  l’IA).
                </Typography>

                {bgMode === 'photo' && bgImg && (
                  <>
                    <Divider />
                    <Typography variant="subtitle2" color="text.secondary">
                      Ajuster l’image (ou tape la photo sur l’aperçu)
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                      <Tooltip title="Pivoter à gauche">
                        <IconButton size="small" onClick={() => setBgRot((r) => r - 90)}>
                          <RotateLeftIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Pivoter à droite">
                        <IconButton size="small" onClick={() => setBgRot((r) => r + 90)}>
                          <RotateRightIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Miroir">
                        <IconButton size="small" color={bgFlipH ? 'primary' : 'default'} onClick={() => setBgFlipH((f) => !f)}>
                          <FlipIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Agrandir (× {bgZoom.toFixed(2)})
                      </Typography>
                      <Slider value={bgZoom} onChange={(_, v) => setBgZoom(Array.isArray(v) ? v[0] : v)} min={1} max={3} step={0.05} size="small" />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Rotation ({Math.round(bgRot)}°)
                      </Typography>
                      <Slider
                        value={bgRot}
                        onChange={(_, v) => setBgRot(Array.isArray(v) ? v[0] : v)}
                        min={-180}
                        max={180}
                        step={1}
                        marks={[{ value: 0 }]}
                        size="small"
                      />
                    </Box>
                  </>
                )}

                <Divider />
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Lisibilité
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Voile sombre — {Math.round(veil * 100)}%
                  </Typography>
                  <Slider value={veil} onChange={(_, v) => setVeil(Array.isArray(v) ? v[0] : v)} min={0} max={0.8} step={0.05} size="small" />
                </Box>
              </Stack>
            </Box>
          )}

          {/* ÉTAPE 3 — Textes */}
          {step === 2 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' }, gap: 3 }}>
              {renderStage()}
              <Stack spacing={2}>
                <Typography variant="h6">3 · Ajoute et place tes textes</Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addBlock}>
                    Ajouter un texte
                  </Button>
                  <Button size="small" color="inherit" startIcon={<RestartAltIcon />} onClick={resetCanvas}>
                    Réinitialiser
                  </Button>
                </Stack>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  maxRows={3}
                  label="Sujet de l’affiche (pour l’IA)"
                  placeholder="Ex. nouveauté croissant pistache à 1,90 €, offre du week-end…"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={textBusy ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                  onClick={() => void generateText()}
                  disabled={textBusy}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Générer des accroches (IA)
                </Button>
                {aiSlogans.length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    {aiSlogans.map((s, i) => (
                      <Chip key={i} icon={<TextFieldsIcon />} label={s} size="small" onClick={() => addTextBlock(s)} />
                    ))}
                  </Stack>
                )}
                <Divider />
                <Typography variant="subtitle2" color="text.secondary">
                  Texte sélectionné
                </Typography>
                {renderBlockEditor()}
              </Stack>
            </Box>
          )}

          {/* ÉTAPE 4 — Export + légende réseaux */}
          {step === 3 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' }, gap: 3 }}>
              {renderStage()}
              <Stack spacing={2}>
                <Typography variant="h6">4 · Exporte tes déclinaisons</Typography>
                <ToggleButtonGroup size="small" exclusive value={format} onChange={(_, v) => v && setFormat(v)} sx={{ flexWrap: 'wrap' }}>
                  {(Object.keys(FORMATS) as Fmt[]).map((f) => (
                    <ToggleButton key={f} value={f}>
                      {FORMATS[f].label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => void exportAllPng()}>
                    Tout exporter (PNG)
                  </Button>
                  <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void downloadPng()}>
                    PNG ({fmt.label})
                  </Button>
                  {fmt.print && (
                    <Button
                      variant="outlined"
                      startIcon={pdfBusy ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                      onClick={() => void downloadPdf()}
                      disabled={pdfBusy}
                    >
                      PDF ({fmt.label})
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                    onClick={() => void save()}
                    disabled={saving}
                  >
                    Enregistrer
                  </Button>
                </Stack>

                <Divider />
                <Typography variant="subtitle2" color="text.secondary">
                  Légende pour les réseaux
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField select size="small" label="Réseau" value={platform} onChange={(e) => setPlatform(e.target.value)} sx={{ flex: 1 }}>
                    {PLATFORMS.map((p) => (
                      <MenuItem key={p} value={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="Ton" value={tone} onChange={(e) => setTone(e.target.value)} sx={{ flex: 1 }}>
                    {TONES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="Longueur" value={length} onChange={(e) => setLength(e.target.value)} sx={{ flex: 1 }}>
                    {LENGTHS.map((l) => (
                      <MenuItem key={l.value} value={l.value}>
                        {l.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Button
                  variant="outlined"
                  startIcon={captionLoading ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                  onClick={() => void onGenerateCaption()}
                  disabled={captionLoading}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {captionLoading ? 'Rédaction…' : 'Générer la légende'}
                </Button>
                {caption && (
                  <Box>
                    <TextField label="Légende (modifiable)" value={caption} onChange={(e) => setCaption(e.target.value)} multiline minRows={5} fullWidth />
                    <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => void copyCaption()} sx={{ mt: 1 }}>
                      {copied ? 'Copié !' : 'Copier la légende'}
                    </Button>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Box>

        {/* Barre d'actions bas : navigation entre étapes. */}
        <AppBar position="fixed" color="default" elevation={3} sx={{ top: 'auto', bottom: 0 }}>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 1 }}>
            <Button startIcon={<NavigateBeforeIcon />} disabled={step === 0} onClick={prevStep}>
              Précédent
            </Button>
            {savedMsg && (
              <Typography variant="caption" color="success.main" sx={{ flex: 1, textAlign: 'center' }}>
                {savedMsg}
              </Typography>
            )}
            {step < 3 ? (
              <Button variant="contained" endIcon={<NavigateNextIcon />} onClick={handleNext}>
                Suivant
              </Button>
            ) : (
              <Button variant="contained" startIcon={<SaveIcon />} onClick={() => void save()} disabled={saving}>
                Enregistrer
              </Button>
            )}
          </Toolbar>
        </AppBar>
      </Dialog>

      {/* Proposition de détourage IA après un import. */}
      <Dialog open={detourAsk} onClose={() => setDetourAsk(false)}>
        <DialogTitle>Détourer avec l’IA ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Veux-tu que l’IA détoure automatiquement le produit et le pose sur le fond aux couleurs de
            l’enseigne ? (Recommandé si ta photo a un décor. Inutile si c’est déjà un PNG détouré.)
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetourAsk(false)}>Non merci</Button>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => {
              setDetourAsk(false)
              void detourer()
            }}
          >
            Oui, détourer
          </Button>
        </DialogActions>
      </Dialog>

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
