import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  AppBar,
  Box,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  Paper,
  Toolbar,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import HomeIcon from '@mui/icons-material/Home'
import { errorMessage } from '../../api/client'
import { listMyEtablissements } from '../../api/daily'
import {
  getOrder,
  getSheet,
  listOrders,
  listSheets,
  ORDER_PERMISSION,
  type OrderSheet,
  type OrderSummary,
  type PurchaseOrder,
  type SheetSummary,
} from '../../api/ordering'
import type { MyEtablissement } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { OrderEntry } from './OrderEntry'

/** Grande tuile tactile. */
function Tile({ title, subtitle, badge, onClick }: { title: string; subtitle?: string; badge?: string; onClick: () => void }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderWidth: 2 }}>
      <ButtonBase
        onClick={onClick}
        sx={{ width: '100%', minHeight: { xs: 84, sm: 120 }, p: { xs: 2, sm: 2.5 }, display: 'block', textAlign: 'left' }}
      >
        <Typography sx={{ fontSize: { xs: 19, sm: 24 }, fontWeight: 800, lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ fontSize: { xs: 14, sm: 16 }, mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
        {badge && <Chip label={badge} color="warning" sx={{ mt: 1, fontSize: 15 }} />}
      </ButtonBase>
    </Paper>
  )
}

/**
 * Passage de commande sur tablette (plein écran, sans menu) : établissement → fournisseur →
 * saisie avec gros boutons −/+. Les brouillons en cours sont repris automatiquement.
 */
export function TabletOrderPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [etabs, setEtabs] = useState<MyEtablissement[] | null>(null)
  const [sheets, setSheets] = useState<SheetSummary[]>([])
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [etab, setEtab] = useState<MyEtablissement | null>(null)
  const [entry, setEntry] = useState<{ sheet: OrderSheet; order: PurchaseOrder | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement))

  const refreshOrders = useCallback(() => {
    listOrders().then(setOrders).catch(() => undefined)
  }, [])

  useEffect(() => {
    Promise.all([listMyEtablissements(), listSheets()])
      .then(([list, s]) => {
        const allowed = list.filter((e) => e.permissions.includes(ORDER_PERMISSION))
        setEtabs(allowed)
        setSheets(s.filter((x) => x.active))
        if (allowed.length === 1) setEtab(allowed[0])
      })
      .catch((e) => setError(errorMessage(e)))
    refreshOrders()
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [refreshOrders])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  /** Brouillon en cours pour ce fournisseur et cet établissement (le plus récent). */
  const draftFor = (sheetId: number) =>
    orders.find((o) => o.sheetId === sheetId && o.etablissementId === etab?.id && o.status === 'BROUILLON')

  const openSheet = async (s: SheetSummary) => {
    setError(null)
    try {
      const draft = draftFor(s.id)
      const [sheet, order] = await Promise.all([getSheet(s.id), draft ? getOrder(draft.id) : Promise.resolve(null)])
      setEntry({ sheet, order })
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const back = () => {
    if (entry) {
      setEntry(null)
      refreshOrders()
    } else if (etab && (etabs?.length ?? 0) > 1) setEtab(null)
    else navigate('/commandes')
  }

  const title = entry ? `${entry.sheet.name}` : etab ? `Commandes — ${etab.name}` : 'Commandes'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar sx={{ gap: { xs: 0.5, sm: 1 }, minHeight: { xs: 56, sm: 72 }, px: { xs: 1, sm: 2 } }}>
          <IconButton onClick={back} aria-label="Retour" sx={{ width: { xs: 44, sm: 56 }, height: { xs: 44, sm: 56 } }}>
            <ArrowBackIcon fontSize="large" />
          </IconButton>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: { xs: 17, sm: 24 }, fontWeight: 800 }} noWrap>
            {title}
          </Typography>
          {me && (
            <Typography color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {me.fullName}
            </Typography>
          )}
          {/* Plein écran : inutile (et souvent absent) sur téléphone. */}
          <IconButton
            onClick={toggleFullscreen}
            aria-label="Plein écran"
            sx={{ width: 56, height: 56, display: { xs: 'none', sm: 'inline-flex' } }}
          >
            {fullscreen ? <FullscreenExitIcon fontSize="large" /> : <FullscreenIcon fontSize="large" />}
          </IconButton>
          <IconButton
            onClick={() => navigate('/')}
            aria-label="Quitter le mode tablette"
            sx={{ width: { xs: 44, sm: 56 }, height: { xs: 44, sm: 56 } }}
          >
            <HomeIcon fontSize="large" />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2, fontSize: 16 }}>{error}</Alert>}

        {etabs === null ? (
          <Typography sx={{ fontSize: 20 }} color="text.secondary">
            Chargement…
          </Typography>
        ) : etabs.length === 0 ? (
          <Alert severity="warning" sx={{ fontSize: 16 }}>
            Vous n'avez le droit de commander pour aucun établissement. Demandez au patron la permission
            « Passer les commandes fournisseurs ».
          </Alert>
        ) : !etab ? (
          <>
            <Typography sx={{ fontSize: { xs: 18, sm: 22 }, fontWeight: 700, mb: 2 }}>Pour quel établissement ?</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
              {etabs.map((e) => (
                <Tile key={e.id} title={e.name} subtitle={e.address ?? undefined} onClick={() => setEtab(e)} />
              ))}
            </Box>
          </>
        ) : !entry ? (
          <>
            <Typography sx={{ fontSize: { xs: 18, sm: 22 }, fontWeight: 700, mb: 2 }}>Quel fournisseur ?</Typography>
            {sheets.length === 0 && (
              <Alert severity="info" sx={{ fontSize: 16 }}>
                Aucun cadencier : le patron doit d'abord créer ou importer les cadenciers fournisseurs.
              </Alert>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
              {sheets.map((s) => {
                const draft = draftFor(s.id)
                return (
                  <Tile
                    key={s.id}
                    title={s.name}
                    subtitle={`${s.supplierName ?? ''}${s.supplierName ? ' · ' : ''}${s.lineCount} produits`}
                    badge={draft ? `Brouillon en cours (${draft.lineCount})` : undefined}
                    onClick={() => void openSheet(s)}
                  />
                )
              })}
            </Box>
            <Button size="large" sx={{ mt: 3, fontSize: 16 }} onClick={() => navigate('/commandes')}>
              Voir l'historique des commandes
            </Button>
          </>
        ) : (
          <OrderEntry
            key={`${entry.sheet.id}-${entry.order?.id ?? 'new'}`}
            sheet={entry.sheet}
            etablissement={{ id: etab.id, name: etab.name }}
            order={entry.order}
            tablet
            onSaved={() => refreshOrders()}
          />
        )}
      </Box>
    </Box>
  )
}
