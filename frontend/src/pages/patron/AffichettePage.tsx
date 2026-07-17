import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
// Polices web embarquées pour les affiches (rendu identique aperçu + export, sur tous les appareils).
import '@fontsource/anton/400.css'
import '@fontsource/pacifico/400.css'
import '@fontsource/lobster/400.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/700.css'
import {
  Alert,
  AppBar,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
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
import ImageIcon from '@mui/icons-material/Image'
import InventoryIcon from '@mui/icons-material/Inventory2'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore'
import EditIcon from '@mui/icons-material/Edit'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import FlipIcon from '@mui/icons-material/Flip'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import { errorMessage } from '../../api/client'
import { getProfile, getSettings, logoUrl } from '../../api/billing'
import { listArticles, photoUrl } from '../../api/costing'
import { composeImages, enhanceImage } from '../../api/insights'
import {
  deleteCommunication,
  generateImageFromPrompt,
  generateSocialPost,
  getCommunication,
  listCommunications,
  saveCommunication,
  updateCommunication,
  type CommunicationSummary,
} from '../../api/communication'
import { listMyEtablissements } from '../../api/daily'
import type { Article } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'
import { buildPosterPdfBlob } from '../../pdf/buildPosterPdf'
import { buildPosterPdfCmykBlob } from '../../pdf/buildPosterPdfCmyk'

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
// Style du fond personnalisé : uni, dégradé doux (0→100 %), diagonale deux tons (bascule réglable),
// ou image générée par l'IA à partir d'une description (plein cadre).
type BgFill = 'uni' | 'grad' | 'diag' | 'ia'
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
  bgFull?: boolean // pastille pleine largeur (bande sur tout le cadre) au lieu d'épouser le texte
  bgSharp?: boolean // pastille à coins carrés (sans arrondi = « sans bordures »)
  font?: string // famille de police (défaut : FONT)
  rot?: number // rotation du texte en degrés (défaut : 0)
}

const FONT = 'Helvetica, Arial, sans-serif'
// Police par défaut des nouveaux textes : « Élégante » (serif). Doit correspondre à une valeur de FONTS.
const DEFAULT_TEXT_FONT = 'Georgia, "Times New Roman", serif'
// Consigne d'amélioration pré-remplie par défaut (détourage & amélioration).
const DEFAULT_IMPROVE_CTX = "Mets sur une ardoise à l'horizontale, c'est pour une pub"
// Polices WEB embarquées (@fontsource, importées ci-dessus) : rendu identique sur tous les appareils,
// dans l'aperçu CSS ET le canvas d'export — contrairement aux polices système (souvent absentes).
// WEB_FONT_FAMILIES sert à les précharger pour que l'export canvas ne retombe pas sur une police système.
const WEB_FONT_FAMILIES = ['Anton', 'Playfair Display', 'Pacifico', 'Lobster']
const FONTS = [
  { label: 'Moderne', value: FONT },
  { label: 'Titre fort (Anton)', value: '"Anton", Impact, sans-serif' },
  { label: 'Chic (Playfair)', value: '"Playfair Display", Georgia, serif' },
  { label: 'Manuscrite (Pacifico)', value: '"Pacifico", cursive' },
  { label: 'Rétro (Lobster)', value: '"Lobster", cursive' },
  { label: 'Élégante (serif)', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Machine à écrire', value: '"Courier New", Courier, monospace' },
]
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
/** Attend le chargement des polices web avant un rendu canvas (sinon l'export retombe sur une police système). */
async function fontsReady(): Promise<void> {
  try {
    if (document.fonts?.ready) await document.fonts.ready
  } catch {
    // Pas de FontFaceSet disponible : on rend quand même (fallback système).
  }
}
const safeColor = (c: string | null | undefined, fb: string) =>
  c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : fb

/** '#rrggbb' + alpha (0..1) → 'rgba(r,g,b,a)' (pour le halo, aperçu CSS et canvas identiques). */
const hexA = (hex: string, alpha: number): string => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? '').trim())
  if (!m) return `rgba(255,255,255,${alpha})`
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/**
 * Éclaircit une image (courbe gamma, sur place) pour compenser l'assombrissement RGB→CMJN à
 * l'impression : le papier réfléchit (moins lumineux que l'écran) et le gamut CMJN écrase les tons
 * foncés. gamma > 1 relève surtout les ombres/tons moyens (là où l'impression fonce le plus).
 * gamma = 1 → aucun changement.
 */
function applyPrintGamma(canvas: HTMLCanvasElement, gamma: number): void {
  if (gamma <= 1.001) return
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const lut = new Uint8ClampedArray(256)
  const inv = 1 / gamma
  for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(i / 255, inv))
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]]
    d[i + 1] = lut[d[i + 1]]
    d[i + 2] = lut[d[i + 2]]
  }
  ctx.putImageData(img, 0, 0)
}

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
  logoScale?: number
  halo?: boolean
  haloColor?: string
  haloOpacity?: number
  haloScale?: number
  articleId?: number | null
  colors: { c1: string; c2: string }
  bgDataUrl: string | null
  bgMode?: BgMode
  solid?: string
  bgRot?: number
  bgFlipH?: boolean
  bgScale?: number
  bgPosX?: number
  bgPosY?: number
  bgGradient?: boolean
  bgFill?: BgFill
  bgColor2?: string
  gradAngle?: number
  diagStart?: number
  diagEnd?: number
  /** Fond IA : image générée (plein cadre) en dataURL + description saisie. */
  bgFillDataUrl?: string | null
  bgAiPrompt?: string
  /** Zone d'amélioration du détourage (mémorisée pour retoucher). */
  improveCtx?: string
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
    font: DEFAULT_TEXT_FONT,
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
  // Le produit détouré/importé est un CALQUE indépendant (image transparente) posé sur le fond de
  // couleur : on peut le déplacer, l'agrandir, le pivoter et le mettre en miroir sans toucher au fond.
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null)
  const [solid, setSolid] = useState('#c2410c')
  const [bgScale, setBgScale] = useState(0.72) // largeur du produit en fraction de la largeur du canevas
  const [bgPosX, setBgPosX] = useState(0.5) // centre X du produit (0..1)
  const [bgPosY, setBgPosY] = useState(0.42) // centre Y du produit (0..1)
  const [bgRot, setBgRot] = useState(0) // rotation du produit (degrés)
  const [bgFlipH, setBgFlipH] = useState(false) // miroir horizontal du produit
  const [imgSel, setImgSel] = useState(false) // produit sélectionné sur le canevas (barre d'outils)
  const [veil, setVeil] = useState(0.35)
  const [colors, setColors] = useState({ c1: '#c2410c', c2: '#9a5417' })
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  const [showLogo, setShowLogo] = useState(true)
  // Taille du logo : multiplicateur appliqué de façon IDENTIQUE à l'aperçu et à l'export (défaut 150 %).
  const [logoScale, setLogoScale] = useState(1.5)
  // Compensation impression (PDF) : gamma d'éclaircissement pour contrer l'assombrissement CMJN.
  // 1.0 = aucune ; ~1.18 = compensation douce par défaut. N'affecte QUE le PDF (impression), pas les PNG écran.
  const [printGamma, setPrintGamma] = useState(1.18)
  // Halo « spot » : dégradé radial clair CENTRÉ SUR LE PRODUIT pour le faire ressortir sur le fond.
  const [halo, setHalo] = useState(false)
  const [haloColor, setHaloColor] = useState('#ffffff')
  const [haloOpacity, setHaloOpacity] = useState(0.45)
  const [haloScale, setHaloScale] = useState(0.45)

  const [articles, setArticles] = useState<Article[]>([])
  const [articleId, setArticleId] = useState<number | ''>('')

  // Nom de l'affiche (pour la galerie « Mes affiches ») — indépendant des textes affichés dessus.
  const [afficheName, setAfficheName] = useState('')
  // Parcours guidé : type d'affiche (1 produit ou menu) + garde-fou anti-doublon des textes.
  const [affType, setAffType] = useState<'produit' | 'menu'>('produit')
  const [seededProducts, setSeededProducts] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState<null | 'retouch' | 'generate' | 'compose' | 'chat'>(null)
  const [menuArticles, setMenuArticles] = useState<Article[]>([])
  const [menuFiles, setMenuFiles] = useState<File[]>([])
  const menuFileRef = useRef<HTMLInputElement | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfCmykBusy, setPdfCmykBusy] = useState(false)
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
  // Id de la communication actuellement éditée (ouverte depuis la galerie ou déjà enregistrée) :
  // tant qu'il est renseigné, « Enregistrer » MET À JOUR cette affiche au lieu d'en créer une autre.
  const [editCommId, setEditCommId] = useState<number | null>(null)
  // Affiches réouvrables (état éditable local).
  const [savedAffiches, setSavedAffiches] = useState<SavedAffiche[]>(() => loadAffiches())
  // Communications archivées côté serveur (réouvrables depuis n'importe quel appareil).
  const [archives, setArchives] = useState<CommunicationSummary[]>([])
  const [searchParams, setSearchParams] = useSearchParams()

  // --- Assistant plein écran (parcours guidé) ---
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState(0)
  // Source : catalogue (produit/menu) ou import de fichier.
  const [srcMode, setSrcMode] = useState<'catalogue' | 'import'>('catalogue')
  // Couleur du fond uni (étape 2), par défaut couleur de l'enseigne (renseignée au chargement charte).
  const [bgColor, setBgColor] = useState('#c2410c')
  // Style du fond personnalisé : uni, dégradé doux, ou diagonale deux tons.
  const [bgFill, setBgFill] = useState<BgFill>('uni')
  const [bgColor2, setBgColor2] = useState('#9a5417')
  const [gradAngle, setGradAngle] = useState(180)
  // Diagonale : positions (%) où la 1re couleur s'arrête et où la 2e commence (bande de transition).
  const [diagStart, setDiagStart] = useState(45)
  const [diagEnd, setDiagEnd] = useState(55)
  // Fond par IA : image générée (plein cadre, derrière le produit) + description saisie par l'utilisateur.
  const [bgFillImg, setBgFillImg] = useState<HTMLImageElement | null>(null)
  const [bgAiPrompt, setBgAiPrompt] = useState('')
  // Retouche : consigne de modification à appliquer sur le fond IA déjà généré (itératif).
  const [bgEditPrompt, setBgEditPrompt] = useState('')
  // Guides d'alignement affichés pendant le déplacement d'un texte (fractions 0..1).
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  // Accroches proposées par l'IA (étape 3).
  // Popup « détourer & améliorer » (auto après import ou via le bouton).
  const [detourAsk, setDetourAsk] = useState(false)
  // Zone d'amélioration : consigne envoyée à l'IA, pré-remplie par défaut, MÉMORISÉE (pré-remplie à la réouverture).
  const [improveCtx, setImproveCtx] = useState(DEFAULT_IMPROVE_CTX)

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId])
  const fmt = FORMATS[format]
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Précharge les polices web dès le montage : sans ça, l'export canvas peut se faire avant que la
  // police choisie soit chargée et retomber sur une police système (aperçu ≠ PDF).
  useEffect(() => {
    if (!document.fonts) return
    for (const family of WEB_FONT_FAMILIES) {
      void document.fonts.load(`400 16px "${family}"`)
      void document.fonts.load(`700 16px "${family}"`)
    }
  }, [])

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
        setBgColor2(c2)
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
  /**
   * Ouvre une affiche archivée. `asCopy` = « utiliser comme modèle » : on garde tout (police,
   * placement, styles…) mais SANS lier l'id → l'enregistrement crée une NOUVELLE affiche et le
   * modèle d'origine reste intact.
   */
  const openCommunication = async (id: number, asCopy = false) => {
    // 1) Serveur (universel, multi-appareils)
    try {
      const detail = await getCommunication(id)
      if (detail.afficheState) {
        const state = JSON.parse(detail.afficheState)
        // Rétro-compat : anciennes affiches sans articleId dans l'état → on reprend celui du record.
        if (state.articleId == null && detail.articleId != null) state.articleId = detail.articleId
        restoreState(state)
        setEditCommId(asCopy ? null : id) // copie → non liée (création) ; sinon édition (mise à jour)
        setSavedMsg(
          asCopy
            ? 'Copie ouverte à partir du modèle — enregistre-la pour créer une nouvelle affiche (le modèle est conservé).'
            : 'Affiche ouverte en édition.',
        )
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
      setEditCommId(asCopy ? null : id)
      if (asCopy) {
        setSavedMsg('Copie ouverte à partir du modèle — enregistre-la pour créer une nouvelle affiche.')
      }
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
    setBgScale(0.72)
    setBgPosX(0.5)
    setBgPosY(0.42)
    setBgRot(0)
    setBgFlipH(false)
    setBgFill('uni')
    setDiagStart(45)
    setDiagEnd(55)
    setBgFillImg(null)
    setBgAiPrompt('')
    setBgEditPrompt('')
    setImproveCtx(DEFAULT_IMPROVE_CTX)
    setAfficheName('')
    setShowLogo(true)
    setLogoScale(1.5)
    setHalo(false)
    setHaloColor('#ffffff')
    setHaloOpacity(0.45)
    setHaloScale(0.45)
    setEditCommId(null) // nouvelle affiche → le prochain « Enregistrer » en crée bien une nouvelle
    setImgSel(false)
    setArticleId('')
    setMenuArticles([])
    setMenuFiles([])
    setAiPrompt('')
    setSeededProducts(false)
    setSrcMode('catalogue')
    setStep(0)
    setError(null)
    setWizardOpen(true)
  }
  const nextStep = () => setStep((s) => Math.min(3, s + 1))
  const prevStep = () => setStep((s) => Math.max(0, s - 1))
  // « Suivant » : après un import (photo), on propose le détourage IA en arrivant à l'étape Fond.
  const handleNext = () => {
    const askDetour = step === 0 && menuFiles.length > 0 && bgImg != null
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
      setEditCommId(null) // création depuis un article → nouvelle affiche, pas une mise à jour
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

  /** Convertit une image/canvas en HTMLImageElement dont la source est un dataURL (persistable, alpha conservé). */
  const toImg = (src: HTMLImageElement | HTMLCanvasElement): Promise<HTMLImageElement> =>
    new Promise((res, rej) => {
      let canvas: HTMLCanvasElement
      if (src instanceof HTMLCanvasElement) {
        canvas = src
      } else {
        canvas = document.createElement('canvas')
        canvas.width = src.naturalWidth || src.width
        canvas.height = src.naturalHeight || src.height
        canvas.getContext('2d')!.drawImage(src, 0, 0)
      }
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = rej
      img.src = canvas.toDataURL('image/png')
    })

  /**
   * Réduit une image (plus grand côté ≤ `maxSide` px) et la renvoie en File, pour l'upload IA :
   * une image plein résolution dépasse la limite multipart et le serveur renvoie « Image trop lourde ».
   * PNG conservé pour un produit détouré (alpha) ; JPEG (bien plus léger) pour une image opaque.
   * Filet de sécurité : si un PNG reste trop lourd (image opaque détaillée), on repasse en JPEG.
   */
  const shrinkToFile = async (
    src: HTMLImageElement,
    name: string,
    maxSide = 1280,
    type: 'image/png' | 'image/jpeg' = 'image/jpeg',
    quality = 0.9,
  ): Promise<File> => {
    const iw = src.naturalWidth || src.width
    const ih = src.naturalHeight || src.height
    const scale = Math.min(1, maxSide / Math.max(iw, ih))
    const w = Math.max(1, Math.round(iw * scale))
    const h = Math.max(1, Math.round(ih * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(src, 0, 0, w, h)
    const toBlob = (t: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, t, q))
    const blob = await toBlob(type, quality)
    // Un PNG opaque détaillé peut rester lourd → on bascule en JPEG (transparence perdue mais envoi garanti).
    if (blob && type === 'image/png' && blob.size > 8_000_000) {
      const jpg = await toBlob('image/jpeg', 0.9)
      if (jpg) return new File([jpg], name.replace(/\.png$/i, '.jpg'), { type: 'image/jpeg' })
    }
    return new File([blob ?? new Blob()], name, { type })
  }

  /** Pose une image PRODUIT (calque transparent déplaçable) sur le fond de couleur. */
  const placeProduct = (img: HTMLImageElement, keepTransform: boolean) => {
    setBgImg(img)
    setBgMode('solid')
    setSolid(bgColor)
    if (!keepTransform) {
      setBgScale(0.72)
      setBgPosX(0.5)
      setBgPosY(0.42)
      setBgRot(0)
      setBgFlipH(false)
    }
  }

  /** Import (ou photo) : la 1re image devient le produit, posée directement sur la couleur du fond. */
  const onImportFiles = async (list: File[]) => {
    if (!list.length) return
    setMenuFiles((prev) => [...prev, ...list].slice(0, 8))
    const img = await toImg(await imgFromBlob(list[0]))
    placeProduct(img, false)
  }

  // --- Déplacement du produit sur le canevas (glisser l'image) ---
  const imgDrag = useRef<{ startX: number; startY: number; rect: DOMRect; cx: number; cy: number } | null>(null)
  const onImgMove = (e: PointerEvent) => {
    const d = imgDrag.current
    if (!d) return
    const dx = (e.clientX - d.startX) / d.rect.width
    const dy = (e.clientY - d.startY) / d.rect.height
    setBgPosX(clamp01(d.cx + dx))
    setBgPosY(clamp01(d.cy + dy))
  }
  const onImgUp = () => {
    imgDrag.current = null
    window.removeEventListener('pointermove', onImgMove)
    window.removeEventListener('pointerup', onImgUp)
  }
  const startImgDrag = (e: ReactPointerEvent) => {
    const stage = stageRef.current
    if (!stage) return
    imgDrag.current = { startX: e.clientX, startY: e.clientY, rect: stage.getBoundingClientRect(), cx: bgPosX, cy: bgPosY }
    window.addEventListener('pointermove', onImgMove)
    window.addEventListener('pointerup', onImgUp)
  }

  // --- Redimensionnement du produit par la poignée d'angle (distance au centre, insensible à la rotation) ---
  const imgResize = useRef<{ startDist: number; startScale: number } | null>(null)
  const onResizeMove = (e: PointerEvent) => {
    const r = imgResize.current
    if (!r || r.startDist === 0) return
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const cx = rect.left + bgPosX * rect.width
    const cy = rect.top + bgPosY * rect.height
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
    setBgScale(Math.max(0.1, Math.min(2, +(r.startScale * (dist / r.startDist)).toFixed(3))))
  }
  const onResizeUp = () => {
    imgResize.current = null
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeUp)
  }
  const startImgResize = (e: ReactPointerEvent) => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const cx = rect.left + bgPosX * rect.width
    const cy = rect.top + bgPosY * rect.height
    imgResize.current = { startDist: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, startScale: bgScale }
    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', onResizeUp)
  }

  // --- Rotation du produit par la poignée (glisser autour du centre, angle précis au degré) ---
  const imgRot = useRef<{ cx: number; cy: number } | null>(null)
  const onRotMove = (e: PointerEvent) => {
    const r = imgRot.current
    if (!r) return
    // Angle poignée→centre ; +90 pour que « poignée en haut » = 0°.
    let deg = (Math.atan2(e.clientY - r.cy, e.clientX - r.cx) * 180) / Math.PI + 90
    deg = ((Math.round(deg) + 180) % 360) - 180 // arrondi au degré, ramené dans [-180, 180]
    // Petit aimant sur les angles remarquables (0/45/90…) à ±3°.
    const near = Math.round(deg / 45) * 45
    if (Math.abs(deg - near) <= 3) deg = near
    setBgRot(deg)
  }
  const onRotUp = () => {
    imgRot.current = null
    window.removeEventListener('pointermove', onRotMove)
    window.removeEventListener('pointerup', onRotUp)
  }
  const startImgRotate = (_e: ReactPointerEvent) => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    imgRot.current = { cx: rect.left + bgPosX * rect.width, cy: rect.top + bgPosY * rect.height }
    window.addEventListener('pointermove', onRotMove)
    window.addEventListener('pointerup', onRotUp)
  }

  /** Produit mis en avant (le 1er du menu le cas échéant) — sert de contexte à la légende. */
  const captionArticle = (): Article | null =>
    affType === 'menu' ? menuArticles[0] ?? null : articles.find((a) => a.id === articleId) ?? null

  /**
   * Rédige la légende réseaux à partir des TEXTES déjà présents sur l'affiche (les blocs), enrichis
   * d'un contexte facultatif et du produit ciblé.
   */
  const onGenerateCaption = async () => {
    const a = captionArticle()
    // La légende part de ce qui est écrit sur l'affiche + un éventuel contexte en plus.
    const posterText = blocks
      .map((b) => b.text.trim())
      .filter(Boolean)
      .join(' — ')
    const brief = [posterText, aiPrompt.trim()].filter(Boolean).join('. ') || null
    if (!brief && !a) {
      setError('Ajoute du texte sur l’affiche (ou un contexte / un produit) pour rédiger la légende.')
      return
    }
    setError(null)
    setCaptionLoading(true)
    try {
      const res = await generateSocialPost({
        etablissement: etab.name ?? 'boulangerie',
        description: etab.description ?? null,
        location: etab.address ?? null,
        brief,
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

  /** Rassemble les fichiers sources : photos importées + photos des produits choisis (toutes réduites). */
  const gatherFiles = async (products: Article[]): Promise<File[]> => {
    const files: File[] = []
    // Réduites avant l'envoi IA : une photo de téléphone plein résolution dépasse la limite
    // multipart (12 Mo) et le serveur renvoie alors un « 401 trompeur ».
    for (let i = 0; i < menuFiles.length; i++) {
      files.push(await shrinkToFile(await imgFromBlob(menuFiles[i]), `import-${i}.jpg`))
    }
    for (const a of products) {
      if (!a.photoFile) continue
      const u = photoUrl(a.photoFile)
      if (!u) continue
      const r = await fetch(u)
      if (!r.ok) continue
      files.push(await shrinkToFile(await imgFromBlob(await r.blob()), `produit-${a.id}.jpg`))
    }
    return files
  }

  /**
   * Détourage : l'IA isole le(s) produit(s) sur un fond MAGENTA pur, que l'appli retire (chroma-key)
   * pour poser le produit sur la couleur EXACTE de l'enseigne — la teinte n'est jamais peinte par l'IA.
   * `context` non vide = « détourer ET améliorer » : l'IA embellit la photo selon la consigne saisie.
   */
  const detourer = async (context?: string) => {
    const products = selectedProducts()
    setError(null)
    setAiBusy('compose')
    try {
      const files = await gatherFiles(products)
      if (files.length === 0) {
        setBgImg(null)
        setBgMode('solid')
        setSolid(bgColor)
        seedProductBlocks(products)
        setSavedMsg('Fond appliqué. Importe une photo (ou choisis un produit avec photo) puis « Détourer ».')
        return
      }
      const ctx = context?.trim() || undefined
      // mode « isolate » : l'IA isole le produit sur un fond magenta pur (prompt dédié côté serveur) ;
      // avec un contexte, elle l'améliore aussi (lumière, couleurs, rendu appétissant).
      const raw = await imgFromBlob(await composeImages(files, ctx, fmt.ar, 'isolate'))
      const img = await toImg(chromaKeyAuto(raw))
      placeProduct(img, !!bgImg) // garde la position/taille si un produit était déjà en place
      seedProductBlocks(products)
      setSavedMsg(ctx ? 'Produit détouré et amélioré ✅' : 'Produit détouré, posé sur le fond (déplaçable) ✅')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setAiBusy(null)
    }
  }

  /**
   * Fond par IA : génère une image plein cadre à partir d'une description libre (texte→image).
   * L'image devient le fond (calque du dessous) ; le produit détouré reste posé par-dessus.
   */
  const generateAiBackground = async () => {
    if (!bgAiPrompt.trim()) {
      setError('Décris le fond que tu veux (ex. « comptoir en bois chaleureux, lumière douce, arrière-plan flou »).')
      return
    }
    setError(null)
    setAiBusy('generate')
    try {
      const img = await toImg(await imgFromBlob(await generateImageFromPrompt(bgAiPrompt.trim(), fmt.ar)))
      setBgFillImg(img)
      setBgMode('solid')
      setBgFill('ia')
      setSavedMsg('Fond IA généré ✅')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setAiBusy(null)
    }
  }

  /**
   * Fond par IA EN INTÉGRANT le produit détouré : l'IA met le produit en scène dans le décor décrit
   * (image→image). Le produit est alors « fondu » dans l'image de fond → on retire le calque séparé.
   */
  const generateAiBackgroundWithProduct = async () => {
    if (!bgImg) {
      setError('Détoure d’abord un produit (bouton « Détourer ») pour l’intégrer au fond généré.')
      return
    }
    if (!bgAiPrompt.trim()) {
      setError('Décris le décor que tu veux autour du produit.')
      return
    }
    setError(null)
    setAiBusy('generate')
    try {
      // Réduit avant l'upload (PNG plein résolution → dépasse la limite multipart → « 401 trompeur »).
      const file = await shrinkToFile(bgImg, 'produit-detoure.png', 1280, 'image/png')
      // La description part en « ambiance » : le prompt serveur recompose le décor AUTOUR du produit.
      const img = await toImg(await imgFromBlob(await enhanceImage(file, bgAiPrompt.trim(), undefined, undefined, fmt.ar)))
      setBgFillImg(img)
      setBgMode('solid')
      setBgFill('ia')
      // Produit désormais intégré à l'image de fond → on enlève le calque produit déplaçable (sinon doublon).
      setBgImg(null)
      setImgSel(false)
      setSavedMsg('Fond IA généré avec le produit intégré ✅')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setAiBusy(null)
    }
  }

  /**
   * Retouche le fond IA DÉJÀ généré : renvoie l'image courante à l'IA (image→image, mode « edit »)
   * avec une consigne de modification, en gardant la composition. Permet d'itérer sans repartir de zéro.
   */
  const editAiBackground = async () => {
    if (!bgFillImg) {
      setError('Génère d’abord un fond IA, puis demande une modification.')
      return
    }
    if (!bgEditPrompt.trim()) {
      setError('Décris la modification (ex. « plus sombre », « ajoute des fleurs séchées »).')
      return
    }
    setError(null)
    setAiBusy('generate')
    try {
      // Le fond IA est opaque (pas de transparence à préserver) → JPEG, bien plus léger que le PNG.
      const file = await shrinkToFile(bgFillImg, 'fond-ia.jpg', 1280, 'image/jpeg')
      const img = await toImg(
        await imgFromBlob(await enhanceImage(file, undefined, bgEditPrompt.trim(), 'edit', fmt.ar)),
      )
      setBgFillImg(img)
      setBgMode('solid')
      setBgFill('ia')
      setBgEditPrompt('')
      setSavedMsg('Fond retouché ✅')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setAiBusy(null)
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
    // Fond : image IA plein cadre, couleur unie, dégradé, diagonale, ou dégradé enseigne.
    if (bgMode === 'solid' && bgFill === 'ia' && bgFillImg) {
      // Image générée par l'IA, cadrée « cover » (remplit tout le cadre, rognée si besoin).
      const iw = bgFillImg.naturalWidth || bgFillImg.width
      const ih = bgFillImg.naturalHeight || bgFillImg.height
      const cover = Math.max(w / iw, h / ih)
      const dw = iw * cover
      const dh = ih * cover
      ctx.drawImage(bgFillImg, (w - dw) / 2, (h - dh) / 2, dw, dh)
    } else if (bgMode === 'solid' && (bgFill === 'uni' || bgFill === 'ia')) {
      // 'ia' choisi mais pas encore généré → aplat neutre en attendant.
      ctx.fillStyle = solid
      ctx.fillRect(0, 0, w, h)
    } else {
      // Ligne de dégradé couvrant le cadre selon l'angle (mêmes conventions que CSS linear-gradient).
      const rad = ((bgMode === 'solid' ? gradAngle : 180) * Math.PI) / 180
      const dx = Math.sin(rad)
      const dy = -Math.cos(rad)
      const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2
      const cx = w / 2
      const cy = h / 2
      const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half)
      const c1 = bgMode === 'solid' ? solid : colors.c1
      const c2 = bgMode === 'solid' ? bgColor2 : colors.c2
      if (bgMode === 'solid' && bgFill === 'diag') {
        // Deux tons franc(s) le long de la diagonale : c1 uni jusqu'à s1, transition, c2 uni dès s2.
        const s1 = Math.min(diagStart, diagEnd) / 100
        const s2 = Math.max(diagStart, diagEnd) / 100
        g.addColorStop(0, c1)
        g.addColorStop(s1, c1)
        g.addColorStop(s2, c2)
        g.addColorStop(1, c2)
      } else {
        g.addColorStop(0, c1)
        g.addColorStop(1, c2)
      }
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
    // Halo « spot » : dégradé radial clair centré sur le produit, posé sur le fond (sous le produit).
    if (halo) {
      const hcx = (bgImg ? bgPosX : 0.5) * w
      const hcy = (bgImg ? bgPosY : 0.42) * h
      const hr = Math.max(1, haloScale * w)
      const hg = ctx.createRadialGradient(hcx, hcy, 0, hcx, hcy, hr)
      hg.addColorStop(0, hexA(haloColor, haloOpacity))
      hg.addColorStop(1, hexA(haloColor, 0))
      ctx.fillStyle = hg
      ctx.fillRect(0, 0, w, h)
    }
    // Produit (calque déplaçable/pivotable), posé PAR-DESSUS le fond
    if (bgImg) {
      const iw = bgImg.naturalWidth || bgImg.width
      const ih = bgImg.naturalHeight || bgImg.height
      const dw = bgScale * w
      const dh = dw * (ih / iw)
      ctx.save()
      ctx.translate(bgPosX * w, bgPosY * h)
      if (bgRot) ctx.rotate((bgRot * Math.PI) / 180)
      if (bgFlipH) ctx.scale(-1, 1)
      ctx.drawImage(bgImg, -dw / 2, -dh / 2, dw, dh)
      ctx.restore()
    }
    // Voile bas pour lisibilité
    if (veil > 0) {
      const grad = ctx.createLinearGradient(0, h * 0.35, 0, h)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, `rgba(0,0,0,${veil})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, h * 0.35, w, h * 0.65)
    }
    // Logo (haut-droite) — rendu STRICTEMENT identique à l'aperçu CSS (mêmes fractions de largeur, cqw) :
    // la BOÎTE BLANCHE est ancrée à 5% du bord (comme content-box + top/right:5cqw), l'image est en
    // retrait du padding, et cadrée « contain » (ratio préservé, pas d'étirement).
    if (showLogo && logoImg) {
      const pad = w * 0.05 // marge au bord (5cqw)
      const bx = w * 0.015 * logoScale // padding interne horizontal (1.5cqw)
      const by = w * 0.01 * logoScale // padding interne vertical (1cqw)
      const ch = w * 0.11 * logoScale // hauteur de la zone image (11cqw)
      const cwMax = w * 0.34 * logoScale // largeur max de la zone image (34cqw)
      const contentW = Math.min(ch * (logoImg.width / logoImg.height), cwMax)
      const boxW = contentW + bx * 2
      const boxH = ch + by * 2
      const boxX = w - pad - boxW
      const boxY = pad
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.beginPath()
      ctx.roundRect(boxX, boxY, boxW, boxH, w * 0.016 * logoScale)
      ctx.fill()
      // « contain » : on ajuste au côté le plus contraint et on centre dans la zone de contenu.
      const s = Math.min(contentW / logoImg.width, ch / logoImg.height)
      const dw = logoImg.width * s
      const dh = logoImg.height * s
      ctx.drawImage(logoImg, boxX + bx + (contentW - dw) / 2, boxY + by + (ch - dh) / 2, dw, dh)
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
        const radius = b.bgSharp ? 0 : fontSize * 0.28
        let rectX: number
        let rectW: number
        if (b.bgFull) {
          // Pleine largeur : bande sur toute la largeur du cadre (indépendante de l'alignement).
          rectX = x
          rectW = maxW
        } else {
          let bx = x
          if (b.align === 'center') bx = x + (maxW - mw) / 2
          else if (b.align === 'right') bx = x + (maxW - mw)
          rectX = bx - p
          rectW = mw + p * 2
        }
        ctx.fillStyle = b.bg
        ctx.beginPath()
        ctx.roundRect(rectX, y - p, rectW, lines.length * lineH + p * 2, radius)
        ctx.fill()
      }
      ctx.fillStyle = b.color
      ctx.textAlign = b.align
      // Bande pleine largeur : on rentre le texte du même retrait que la pastille de l'aperçu CSS
      // (sinon il colle au bord dans l'export alors qu'il est en retrait à l'écran).
      const inset = b.bg && b.bgFull ? fontSize * 0.3 : 0
      const tx =
        b.align === 'center' ? x + maxW / 2 : b.align === 'right' ? x + maxW - inset : x + inset
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
    await fontsReady()
    const blob = await canvasToBlob(renderToCanvas(fmtKey))
    if (blob) downloadBlob(blob, `affichette-${fmtKey}.png`)
  }
  const downloadPdf = async (fmtKey: Fmt = format) => {
    const size = FORMATS[fmtKey].size
    if (!size) return // PDF réservé aux formats imprimables (A4/A5)
    setError(null)
    setPdfBusy(true)
    try {
      await fontsReady()
      const canvas = renderToCanvas(fmtKey)
      // Compensation impression : on éclaircit le rendu du PDF (et lui seul) pour contrer le CMJN.
      applyPrintGamma(canvas, printGamma)
      const dataUrl = canvas.toDataURL('image/png')
      const blob = await buildPosterPdfBlob(dataUrl, size)
      downloadBlob(blob, `affichette-${fmtKey}.pdf`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPdfBusy(false)
    }
  }
  /**
   * Export PDF DeviceCMYK (test) : le visuel est stocké en CMJN, pour voir si le tirage sort plus
   * proche de l'écran qu'avec le PDF RGB (dont la conversion CMJN est faite par l'imprimante).
   */
  const downloadPdfCmyk = async (fmtKey: Fmt = format) => {
    const size = FORMATS[fmtKey].size
    if (!size) return
    setError(null)
    setPdfCmykBusy(true)
    try {
      await fontsReady()
      const blob = await buildPosterPdfCmykBlob(renderToCanvas(fmtKey), size, printGamma)
      downloadBlob(blob, `affichette-${fmtKey}-cmjn.pdf`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPdfCmykBusy(false)
    }
  }
  /** Exporte un PNG pour CHAQUE déclinaison (réseaux + impression). */
  const exportAllPng = async () => {
    await fontsReady()
    for (const key of Object.keys(FORMATS) as Fmt[]) {
      const blob = await canvasToBlob(renderToCanvas(key))
      if (blob) downloadBlob(blob, `affichette-${key}.png`)
    }
  }
  /** Le fond BRUT (sans voile/texte) en dataURL, pour pouvoir rouvrir l'affiche sans cumuler le voile. */
  // Le produit est déjà stocké en dataURL (toImg) → réutilisable tel quel pour la sauvegarde.
  const bgToDataUrl = (): string | null => bgImg?.src ?? null

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
      logoScale,
      halo,
      haloColor,
      haloOpacity,
      haloScale,
      articleId: articleId === '' ? null : articleId,
      colors,
      bgDataUrl: bgToDataUrl(),
      bgMode,
      solid,
      bgRot,
      bgFlipH,
      bgScale,
      bgPosX,
      bgPosY,
      bgFill,
      // `bgGradient` conservé pour compat des affiches enregistrées avant l'ajout de `bgFill`.
      bgGradient: bgFill !== 'uni',
      bgColor2,
      gradAngle,
      diagStart,
      diagEnd,
      bgFillDataUrl: bgFillImg?.src ?? null,
      bgAiPrompt,
      improveCtx,
    }
    // On garde les 6 dernières (le fond en dataURL est lourd → quota localStorage).
    // On dédoublonne par communication (réenregistrer la même affiche remplace l'ancienne).
    let next = [entry, ...savedAffiches.filter((a) => a.commId == null || a.commId !== commId)].slice(0, 6)
    let stored = false
    while (next.length > 0) {
      try {
        localStorage.setItem(AFFICHES_KEY, JSON.stringify(next))
        stored = true
        break
      } catch {
        next = next.slice(0, next.length - 1) // quota dépassé : on retire la plus ancienne
      }
    }
    // Si même l'entrée seule dépasse le quota (rien de stocké), on garde l'état précédent :
    // sinon l'état React se viderait alors que localStorage garde l'ancienne liste (désync).
    // L'affiche est de toute façon déjà sauvegardée côté serveur.
    if (stored) setSavedAffiches(next)
  }

  /** Restaure un état éditable (fond BRUT + blocs + réglages) — commun au cache local et au serveur. */
  const restoreState = (s: {
    format?: Fmt
    blocks?: Block[]
    veil?: number
    showLogo?: boolean
    logoScale?: number
    halo?: boolean
    haloColor?: string
    haloOpacity?: number
    haloScale?: number
    articleId?: number | null
    colors?: { c1: string; c2: string }
    bgDataUrl?: string | null
    bgMode?: BgMode
    solid?: string
    bgRot?: number
    bgFlipH?: boolean
    bgScale?: number
    bgPosX?: number
    bgPosY?: number
    bgGradient?: boolean
    bgFill?: BgFill
    bgColor2?: string
    gradAngle?: number
    diagStart?: number
    diagEnd?: number
    bgFillDataUrl?: string | null
    bgAiPrompt?: string
    improveCtx?: string
    afficheName?: string
    caption?: string
    socialPlatform?: string
    tone?: string
    length?: string
  }) => {
    setEditingId(null)
    setSelectedId(null)
    if (s.format && s.format in FORMATS) setFormat(s.format)
    if (Array.isArray(s.blocks)) setBlocks(s.blocks)
    if (typeof s.veil === 'number') setVeil(s.veil)
    if (typeof s.showLogo === 'boolean') setShowLogo(s.showLogo)
    setLogoScale(typeof s.logoScale === 'number' ? s.logoScale : 1.5)
    setHalo(!!s.halo)
    if (typeof s.haloColor === 'string') setHaloColor(s.haloColor)
    if (typeof s.haloOpacity === 'number') setHaloOpacity(s.haloOpacity)
    if (typeof s.haloScale === 'number') setHaloScale(s.haloScale)
    // Toujours défini (jamais laissé « en mémoire » d'une affiche précédente → évite un mauvais lien produit).
    setArticleId(typeof s.articleId === 'number' ? s.articleId : '')
    if (s.colors && s.colors.c1 && s.colors.c2) setColors(s.colors)
    if (typeof s.caption === 'string') setCaption(s.caption)
    if (s.socialPlatform && PLATFORMS.includes(s.socialPlatform)) setPlatform(s.socialPlatform)
    if (s.tone) setTone(s.tone)
    if (s.length) setLength(s.length)
    if (typeof s.solid === 'string') setSolid(s.solid)
    setBgRot(typeof s.bgRot === 'number' ? s.bgRot : 0)
    setBgFlipH(!!s.bgFlipH)
    setBgScale(typeof s.bgScale === 'number' ? s.bgScale : 0.72)
    setBgPosX(typeof s.bgPosX === 'number' ? s.bgPosX : 0.5)
    setBgPosY(typeof s.bgPosY === 'number' ? s.bgPosY : 0.42)
    // Repli : les affiches enregistrées avant `bgFill` ne connaissent que `bgGradient` (booléen).
    setBgFill(s.bgFill ?? (s.bgGradient ? 'grad' : 'uni'))
    if (typeof s.bgColor2 === 'string') setBgColor2(s.bgColor2)
    if (typeof s.gradAngle === 'number') setGradAngle(s.gradAngle)
    if (typeof s.diagStart === 'number') setDiagStart(s.diagStart)
    if (typeof s.diagEnd === 'number') setDiagEnd(s.diagEnd)
    setBgAiPrompt(typeof s.bgAiPrompt === 'string' ? s.bgAiPrompt : '')
    setImproveCtx(typeof s.improveCtx === 'string' ? s.improveCtx : DEFAULT_IMPROVE_CTX)
    setAfficheName(typeof s.afficheName === 'string' ? s.afficheName : '')
    // Fond IA : recharge l'image générée (plein cadre) si elle a été enregistrée.
    if (s.bgFillDataUrl) {
      const bgi = new Image()
      bgi.onload = () => setBgFillImg(bgi)
      bgi.src = s.bgFillDataUrl
    } else {
      setBgFillImg(null)
    }
    setImgSel(false)
    // Produit : image transparente posée sur le fond de couleur (mode 'solid' derrière).
    if (s.bgDataUrl) {
      const img = new Image()
      img.onload = () => {
        setBgImg(img)
        setBgMode(s.bgMode === 'brand' ? 'brand' : 'solid')
      }
      img.src = s.bgDataUrl
    } else {
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
      await fontsReady()
      const blob = await canvasToBlob(renderToCanvas())
      // Titre affiché dans la galerie : nom personnalisé si donné, sinon 1er texte de l'affiche.
      const headline = afficheName.trim() || blocks[0]?.text?.slice(0, 200) || 'Affichette'
      // État éditable (fond BRUT + blocs + réglages) envoyé AU SERVEUR → édition depuis n'importe où.
      const afficheState = JSON.stringify({
        v: 1,
        afficheName,
        format,
        blocks,
        veil,
        showLogo,
        logoScale,
        halo,
        haloColor,
        haloOpacity,
        haloScale,
        articleId: articleId === '' ? null : articleId,
        colors,
        bgDataUrl: bgToDataUrl(),
        bgMode,
        solid,
        bgRot,
        bgFlipH,
        bgScale,
        bgPosX,
        bgPosY,
        bgFill,
        bgGradient: bgFill !== 'uni', // compat des états enregistrés avant `bgFill`
        bgColor2,
        gradAngle,
        diagStart,
        diagEnd,
        bgFillDataUrl: bgFillImg?.src ?? null,
        bgAiPrompt,
        improveCtx,
        caption,
        socialPlatform: platform,
        tone,
        length,
      })
      const input = {
        headline,
        articleId: articleId === '' ? null : articleId,
        platform: `Affichette ${fmt.label}`,
        tone,
        length,
        caption: caption || null,
        afficheState,
      }
      // Édition d'une affiche existante → PUT (mise à jour) ; sinon POST (création).
      const wasEditing = editCommId != null
      const saved =
        editCommId != null
          ? await updateCommunication(editCommId, input, blob)
          : await saveCommunication(input, blob)
      // On retient l'id : ré-enregistrer dans la même session met à jour au lieu de dupliquer.
      setEditCommId(saved.id)
      // Cache local aussi (réouverture hors-ligne / rapide via le déroulant).
      persistEditable(headline, saved.id)
      refreshArchives()
      setSavedMsg(wasEditing ? 'Affichette mise à jour.' : 'Affichette enregistrée (et réouvrable pour édition).')
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
      ? bgFill === 'ia' && bgFillImg
        ? { backgroundImage: `url(${bgFillImg.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : {
            background:
              bgFill === 'uni' || bgFill === 'ia'
                ? solid
                : bgFill === 'diag'
                  ? `linear-gradient(${gradAngle}deg, ${solid} 0%, ${solid} ${Math.min(diagStart, diagEnd)}%, ${bgColor2} ${Math.max(diagStart, diagEnd)}%, ${bgColor2} 100%)`
                  : `linear-gradient(${gradAngle}deg, ${solid}, ${bgColor2})`,
          }
      : bgMode === 'brand'
        ? { background: `linear-gradient(${colors.c1}, ${colors.c2})` }
        : {}

  // Scène éditable (aperçu + manipulation des textes). Réutilisée dans plusieurs étapes.
  const renderStage = () => (
    // alignItems: flex-start → la scène garde son ratio (aspectRatio) et ne s'étire pas verticalement
    // quand la colonne est haute (sinon elle suit la hauteur du formulaire voisin et se déforme).
    <Box
      sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', bgcolor: 'action.hover', borderRadius: 1, p: 1 }}
    >
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
        {halo && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: `radial-gradient(circle ${haloScale * 100}cqw at ${(bgImg ? bgPosX : 0.5) * 100}% ${
                (bgImg ? bgPosY : 0.42) * 100
              }%, ${hexA(haloColor, haloOpacity)} 0%, ${hexA(haloColor, 0)} 100%)`,
            }}
          />
        )}
        {bgImg && (
          <Box
            onPointerDown={(e) => {
              e.stopPropagation()
              setSelectedId(null)
              setImgSel(true)
              startImgDrag(e)
            }}
            sx={{
              position: 'absolute',
              left: `${bgPosX * 100}%`,
              top: `${bgPosY * 100}%`,
              width: `${bgScale * 100}%`,
              transform: `translate(-50%, -50%) rotate(${bgRot}deg) scaleX(${bgFlipH ? -1 : 1})`,
              transformOrigin: 'center',
              outline: imgSel ? '2px solid rgba(255,255,255,0.9)' : 'none',
              outlineOffset: 2,
              touchAction: 'none',
              cursor: 'move',
            }}
          >
            <Box component="img" src={bgImg.src} draggable={false} sx={{ display: 'block', width: '100%', pointerEvents: 'none' }} />
            {imgSel && (
              <Box
                onPointerDown={(e) => {
                  e.stopPropagation()
                  startImgResize(e)
                }}
                sx={{
                  position: 'absolute',
                  right: -8,
                  bottom: -8,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  border: '2px solid #fff',
                  cursor: 'nwse-resize',
                  touchAction: 'none',
                }}
              />
            )}
            {imgSel && (
              <>
                {/* Tige reliant la poignée de rotation au bord haut de l'image. */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: '50%',
                    top: -24,
                    width: 2,
                    height: 24,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                  }}
                />
                <Box
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    startImgRotate(e)
                  }}
                  sx={{
                    position: 'absolute',
                    left: '50%',
                    top: -34,
                    transform: 'translateX(-50%)',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: '#fff',
                    border: '2px solid',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'grab',
                    touchAction: 'none',
                  }}
                >
                  <RotateRightIcon sx={{ fontSize: 13 }} />
                </Box>
              </>
            )}
          </Box>
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
              // Unités cqw (= % de la largeur de la scène) : dimensionnement IDENTIQUE au canvas/PDF.
              top: '5cqw',
              right: '5cqw',
              height: `${11 * logoScale}cqw`,
              maxWidth: `${34 * logoScale}cqw`,
              width: 'auto',
              objectFit: 'contain',
              boxSizing: 'content-box',
              bgcolor: 'rgba(255,255,255,0.92)',
              borderRadius: `${1.6 * logoScale}cqw`,
              px: `${1.5 * logoScale}cqw`,
              py: `${1 * logoScale}cqw`,
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
                  ...(b.bg
                    ? {
                        bgcolor: b.bg,
                        borderRadius: b.bgSharp ? 0 : 1,
                        px: 0.6,
                        py: 0.2,
                        // Pleine largeur : la pastille devient une bande qui remplit tout le cadre.
                        ...(b.bgFull ? { display: 'block', width: '100%' } : {}),
                      }
                    : {}),
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
        {/* Barre d'outils flottante quand le PRODUIT est sélectionné (clic sur l'image). */}
        {imgSel && bgImg && (
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
              <IconButton size="small" onClick={() => setBgScale((z) => Math.min(1.6, +(z + 0.08).toFixed(2)))}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Réduire">
              <IconButton size="small" onClick={() => setBgScale((z) => Math.max(0.15, +(z - 0.08).toFixed(2)))}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Réinitialiser">
              <IconButton
                size="small"
                onClick={() => {
                  setBgRot(0)
                  setBgScale(0.72)
                  setBgPosX(0.5)
                  setBgPosY(0.42)
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
        {selected.bg && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Button
              size="small"
              variant={selected.bgFull ? 'contained' : 'outlined'}
              onClick={() => updateBlock(selected.id, { bgFull: !selected.bgFull })}
            >
              Pleine largeur
            </Button>
            <Button
              size="small"
              variant={selected.bgSharp ? 'contained' : 'outlined'}
              onClick={() => updateBlock(selected.id, { bgSharp: !selected.bgSharp })}
            >
              Coins carrés
            </Button>
          </Stack>
        )}
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
                  {c.hasAfficheState && (
                    <Tooltip title="Réutiliser comme modèle (police + placement) dans une nouvelle affiche">
                      <Button
                        size="small"
                        startIcon={<ContentCopyIcon />}
                        onClick={() => void openCommunication(c.id, true)}
                      >
                        Modèle
                      </Button>
                    </Tooltip>
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

      {/* Assistant plein écran (parcours guidé, responsive). Paper en colonne flex : en-tête + contenu
          défilant + pied FIXES dans la mise en page → le footer ne recouvre jamais le contenu. */}
      <Dialog
        fullScreen
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        slotProps={{ paper: { sx: { display: 'flex', flexDirection: 'column', overflow: 'hidden' } } }}
      >
        <AppBar position="static" color="default" elevation={1} sx={{ flexShrink: 0 }}>
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={() => setWizardOpen(false)} aria-label="Fermer">
              <CloseIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Créer une affiche
            </Typography>
          </Toolbar>
          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              <Stack direction="row" spacing={0.75} sx={{ justifyContent: 'center', alignItems: 'center' }}>
                {WIZARD_STEPS.map((label, i) => (
                  <Box
                    key={label}
                    onClick={() => setStep(i)}
                    sx={{
                      width: i === step ? 20 : 8,
                      height: 8,
                      borderRadius: 4,
                      cursor: 'pointer',
                      transition: 'all .2s',
                      bgcolor: i === step ? 'primary.main' : i < step ? 'primary.light' : 'action.disabled',
                    }}
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.25 }}>
                {WIZARD_STEPS[step]}
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

        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box sx={{ p: { xs: 2, md: 3 }, pb: 4, maxWidth: 1100, mx: 'auto', width: '100%' }}>
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
                onChange={(_, v: 'catalogue' | 'import' | null) => v && setSrcMode(v)}
                sx={{ flexWrap: 'wrap' }}
              >
                <ToggleButton value="catalogue">
                  <InventoryIcon sx={{ mr: 1 }} /> Produit du catalogue
                </ToggleButton>
                <ToggleButton value="import">
                  <ImageIcon sx={{ mr: 1 }} /> Importer une image
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
            </Stack>
          )}

          {/* ÉTAPE 2 — Fond aux couleurs de l'enseigne + détourage IA */}
          {step === 1 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' }, gap: 3, alignItems: 'start' }}>
              {renderStage()}
              <Stack spacing={2}>
                <Typography variant="h6">2 · Fond & détourage</Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={bgFill}
                  onChange={(_, v: BgFill | null) => {
                    if (!v) return
                    setBgFill(v)
                    setBgMode('solid') // le fond choisi remplace le dégradé enseigne par défaut
                    // La diagonale n'a de sens qu'en biais : bascule à 135° si on est sur un angle droit.
                    if (v === 'diag' && [0, 90, 180, 270, 360].includes(gradAngle)) setGradAngle(135)
                  }}
                >
                  <ToggleButton value="uni">Fond uni</ToggleButton>
                  <ToggleButton value="grad">Dégradé</ToggleButton>
                  <ToggleButton value="diag">Diagonale</ToggleButton>
                  <ToggleButton value="ia">
                    <AutoAwesomeIcon sx={{ mr: 0.5, fontSize: 18 }} /> IA
                  </ToggleButton>
                </ToggleButtonGroup>
                {bgFill !== 'ia' && (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <TextField
                      type="color"
                      size="small"
                      label={bgFill === 'uni' ? 'Couleur du fond' : 'Couleur 1'}
                      value={bgColor}
                      onChange={(e) => {
                        setBgColor(e.target.value)
                        setSolid(e.target.value)
                        setBgMode('solid')
                      }}
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={{ width: 108 }}
                    />
                    {(bgFill === 'grad' || bgFill === 'diag') && (
                      <TextField
                        type="color"
                        size="small"
                        label="Couleur 2"
                        value={bgColor2}
                        onChange={(e) => setBgColor2(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{ width: 108 }}
                      />
                    )}
                  </Stack>
                )}
                {(bgFill === 'grad' || bgFill === 'diag') && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {bgFill === 'diag' ? 'Angle de la diagonale' : 'Sens du dégradé'} ({gradAngle}°)
                    </Typography>
                    <Slider
                      value={gradAngle}
                      onChange={(_, v) => setGradAngle(Array.isArray(v) ? v[0] : v)}
                      min={0}
                      max={360}
                      step={15}
                      marks={[{ value: 0 }, { value: 90 }, { value: 180 }, { value: 270 }]}
                      size="small"
                    />
                  </Box>
                )}
                {bgFill === 'diag' && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Bascule des couleurs ({Math.min(diagStart, diagEnd)}% → {Math.max(diagStart, diagEnd)}%) —
                      rapproche les curseurs pour une coupe nette, écarte-les pour un fondu.
                    </Typography>
                    <Slider
                      value={[diagStart, diagEnd]}
                      onChange={(_, v) => {
                        if (!Array.isArray(v)) return
                        setDiagStart(v[0])
                        setDiagEnd(v[1])
                      }}
                      min={0}
                      max={100}
                      step={1}
                      marks={[{ value: 50 }]}
                      valueLabelDisplay="auto"
                      size="small"
                    />
                  </Box>
                )}
                {bgFill === 'ia' && (
                  <Stack spacing={1}>
                    <TextField
                      label="Décris le fond que tu veux"
                      placeholder="Ex. comptoir en bois chaleureux, lumière douce du matin, arrière-plan légèrement flou"
                      value={bgAiPrompt}
                      onChange={(e) => setBgAiPrompt(e.target.value)}
                      multiline
                      minRows={2}
                      size="small"
                      fullWidth
                    />
                    <Button
                      variant="contained"
                      startIcon={aiBusy === 'generate' ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                      onClick={() => void generateAiBackground()}
                      disabled={aiBusy !== null || !bgAiPrompt.trim()}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {bgFillImg ? 'Régénérer le fond' : 'Générer le fond'}
                    </Button>
                    {bgImg && (
                      <Button
                        variant="outlined"
                        startIcon={aiBusy === 'generate' ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                        onClick={() => void generateAiBackgroundWithProduct()}
                        disabled={aiBusy !== null || !bgAiPrompt.trim()}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Régénérer le fond avec l'image détourée
                      </Button>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      « Générer le fond » crée une image à partir de ta seule description. « …avec l'image détourée »
                      met en plus ton produit détouré en scène dans le décor décrit (il est alors intégré à l'image).
                    </Typography>
                    {bgFillImg && (
                      <>
                        <Divider sx={{ my: 0.5 }}>Retouche</Divider>
                        <TextField
                          label="Modifier ce fond (retouche IA)"
                          placeholder="Ex. plus sombre, ajoute des fleurs séchées, ambiance plus chaleureuse, enlève l'arrière-plan flou"
                          value={bgEditPrompt}
                          onChange={(e) => setBgEditPrompt(e.target.value)}
                          multiline
                          minRows={2}
                          size="small"
                          fullWidth
                        />
                        <Button
                          variant="outlined"
                          startIcon={aiBusy === 'generate' ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                          onClick={() => void editAiBackground()}
                          disabled={aiBusy !== null || !bgEditPrompt.trim()}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          Modifier le fond
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                          Applique une modification à l'image déjà générée (part de cette image, garde la composition)
                          — enchaîne les retouches pour affiner.
                        </Typography>
                      </>
                    )}
                  </Stack>
                )}
                <Button
                  variant="contained"
                  startIcon={aiBusy !== null ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
                  onClick={() => setDetourAsk(true)}
                  disabled={aiBusy !== null}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Détourer &amp; améliorer la photo
                </Button>

                {bgImg && (
                  <>
                    <Divider />
                    <Typography variant="subtitle2" color="text.secondary">
                      Ajuster le produit (glisse-le sur l’aperçu pour le déplacer)
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
                        Taille (× {bgScale.toFixed(2)})
                      </Typography>
                      <Slider value={bgScale} onChange={(_, v) => setBgScale(Array.isArray(v) ? v[0] : v)} min={0.15} max={1.6} step={0.02} size="small" />
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
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Halo (spot derrière le produit)
                    </Typography>
                    <Button size="small" variant={halo ? 'contained' : 'outlined'} onClick={() => setHalo(!halo)}>
                      {halo ? 'Affiché' : 'Masqué'}
                    </Button>
                  </Stack>
                  {halo && (
                    <>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                        <TextField
                          type="color"
                          size="small"
                          label="Couleur"
                          value={haloColor}
                          onChange={(e) => setHaloColor(e.target.value)}
                          slotProps={{ inputLabel: { shrink: true } }}
                          sx={{ width: 90 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Centré sur le produit — déplace le produit pour déplacer le halo.
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Taille — {Math.round(haloScale * 100)}%
                      </Typography>
                      <Slider value={haloScale} onChange={(_, v) => setHaloScale(Array.isArray(v) ? v[0] : v)} min={0.15} max={0.9} step={0.05} size="small" />
                      <Typography variant="caption" color="text.secondary">
                        Intensité — {Math.round(haloOpacity * 100)}%
                      </Typography>
                      <Slider value={haloOpacity} onChange={(_, v) => setHaloOpacity(Array.isArray(v) ? v[0] : v)} min={0.1} max={1} step={0.05} size="small" />
                    </>
                  )}
                </Box>
                <Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Logo
                    </Typography>
                    <Button
                      size="small"
                      variant={showLogo ? 'contained' : 'outlined'}
                      onClick={() => setShowLogo(!showLogo)}
                    >
                      {showLogo ? 'Affiché' : 'Masqué'}
                    </Button>
                  </Stack>
                  {showLogo && logoImg && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        Taille du logo — {Math.round(logoScale * 100)}%
                      </Typography>
                      <Slider
                        value={logoScale}
                        onChange={(_, v) => setLogoScale(Array.isArray(v) ? v[0] : v)}
                        min={0.5}
                        max={2}
                        step={0.1}
                        marks={[{ value: 1 }]}
                        size="small"
                      />
                    </>
                  )}
                  {showLogo && !logoImg && (
                    <Typography variant="caption" color="text.secondary">
                      Aucun logo dans la charte — ajoute-le dans les réglages de l'enseigne.
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          )}

          {/* ÉTAPE 3 — Textes */}
          {step === 2 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' }, gap: 3, alignItems: 'start' }}>
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
                <Typography variant="subtitle2" color="text.secondary">
                  Texte sélectionné
                </Typography>
                {renderBlockEditor()}
              </Stack>
            </Box>
          )}

          {/* ÉTAPE 4 — Export + légende réseaux */}
          {step === 3 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' }, gap: 3, alignItems: 'start' }}>
              {renderStage()}
              <Stack spacing={2}>
                <Typography variant="h6">4 · Exporte tes déclinaisons</Typography>
                <TextField
                  size="small"
                  fullWidth
                  label="Nom de l’affiche"
                  placeholder="Ex. Menu Pause fraîcheur — juillet"
                  helperText="Sert à retrouver l’affiche dans « Mes affiches ». N’apparaît pas sur le visuel."
                  value={afficheName}
                  onChange={(e) => setAfficheName(e.target.value)}
                />
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
                  {fmt.print && (
                    <Tooltip title="PDF où les couleurs sont déjà en CMJN (essai pour un tirage plus fidèle)">
                      <Button
                        variant="outlined"
                        startIcon={pdfCmykBusy ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                        onClick={() => void downloadPdfCmyk()}
                        disabled={pdfCmykBusy}
                      >
                        PDF CMJN (test)
                      </Button>
                    </Tooltip>
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

                {fmt.print && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Compensation impression (CMJN) — {Math.round((printGamma - 1) * 100)}%
                    </Typography>
                    <Slider
                      value={printGamma}
                      onChange={(_, v) => setPrintGamma(Array.isArray(v) ? v[0] : v)}
                      min={1}
                      max={1.4}
                      step={0.02}
                      marks={[{ value: 1 }, { value: 1.18 }]}
                      size="small"
                    />
                    <Typography variant="caption" color="text.secondary">
                      Éclaircit le PDF pour contrer l'assombrissement à l'impression (0 % = aucune).
                      N'affecte pas les PNG (écran).
                    </Typography>
                  </Box>
                )}

                <Divider />
                <Typography variant="subtitle2" color="text.secondary">
                  Légende pour les réseaux
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Rédigée à partir des textes présents sur l’affiche. Ajoute au besoin un contexte en plus.
                </Typography>
                <Stack direction="column" spacing={1.5}>
                  <TextField select size="small" label="Réseau" value={platform} onChange={(e) => setPlatform(e.target.value)} fullWidth>
                    {PLATFORMS.map((p) => (
                      <MenuItem key={p} value={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="Ton" value={tone} onChange={(e) => setTone(e.target.value)} fullWidth>
                    {TONES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField select size="small" label="Longueur" value={length} onChange={(e) => setLength(e.target.value)} fullWidth>
                    {LENGTHS.map((l) => (
                      <MenuItem key={l.value} value={l.value}>
                        {l.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    fullWidth
                    multiline
                    maxRows={3}
                    label="Contexte en plus (facultatif)"
                    placeholder="Ex. offre du week-end, nouveauté, événement, précision sur le produit…"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
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
        </Box>

        {/* Barre d'actions bas : ligne fixe de la mise en page (jamais par-dessus le contenu). */}
        <AppBar position="static" color="default" elevation={3} sx={{ flexShrink: 0 }}>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 1, pb: 'env(safe-area-inset-bottom)' }}>
            <Button startIcon={<NavigateBeforeIcon />} disabled={step === 0} onClick={prevStep}>
              Précédent
            </Button>
            {savedMsg && (
              <Typography
                variant="caption"
                color="success.main"
                noWrap
                sx={{ flex: 1, textAlign: 'center', minWidth: 0, px: 1 }}
              >
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

      {/* Détourer & améliorer : popup unique (ouverte auto après un import, ou via le bouton). La zone
          d'amélioration est mémorisée → à la réouverture, la consigne précédente est déjà là. */}
      <Dialog open={detourAsk} onClose={() => setDetourAsk(false)} fullWidth maxWidth="sm">
        <DialogTitle>Détourer &amp; améliorer la photo</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            L’IA isole le produit, le pose sur le fond aux couleurs de l’enseigne et soigne le rendu.
            Décris ce que tu veux mettre en valeur (facultatif) — laisse vide pour un simple détourage.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Zone d’amélioration (facultatif)"
            placeholder="Ex. plus appétissant, lumière chaude du matin, met en valeur la garniture, effet frais…"
            value={improveCtx}
            onChange={(e) => setImproveCtx(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetourAsk(false)}>Non merci</Button>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => {
              setDetourAsk(false)
              void detourer(improveCtx)
            }}
          >
            Détourer
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
