import { useState, type MouseEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListSubheader,
  Menu,
  MenuItem,
  Popover,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import LogoutIcon from '@mui/icons-material/Logout'
import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsIcon from '@mui/icons-material/Settings'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import type { Me } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { isAdmin, isEmploye, isPatron } from '../auth/roles'
import { useSettings } from '../settings/SettingsContext'
import { BrandLogo } from './BrandLogo'
import { HeaderSettingsContext, type HeaderSettings } from './HeaderSettings'

function roleLabel(me: Me): string {
  if (isAdmin(me)) return 'Super-Admin'
  if (me.role === 'PATRON') return 'Patron'
  return 'Employé'
}

interface NavItem {
  to: string
  label: string
  /** Classe Font Awesome (ex. « fa-solid fa-chart-line »). */
  icon?: string
}
interface NavGroup {
  /** Vide = items rendus en onglets directs (admin/employé) ; sinon = menu déroulant. */
  label: string
  /** Icône Font Awesome du groupe (bouton déroulant). */
  icon?: string
  items: NavItem[]
}

/** Icône Font Awesome rendue en élément <i> (chargée via CDN). */
function FaIcon({ icon, sx }: { icon: string; sx?: object }) {
  return (
    <Box
      component="i"
      className={icon}
      aria-hidden
      sx={{ fontSize: 15, width: 20, textAlign: 'center', color: 'inherit', flexShrink: 0, ...sx }}
    />
  )
}

function navGroupsFor(me: Me): NavGroup[] {
  if (isAdmin(me)) {
    return [
      {
        label: '',
        items: [
          { to: '/admin/tenants', label: 'Tenants', icon: 'fa-solid fa-building' },
          { to: '/admin/users', label: 'Utilisateurs', icon: 'fa-solid fa-users-gear' },
          { to: '/admin/audit', label: 'Historique', icon: 'fa-solid fa-clock-rotate-left' },
        ],
      },
    ]
  }
  if (isPatron(me)) {
    return [
      {
        label: 'Pilotage',
        icon: 'fa-solid fa-compass',
        items: [
          { to: '/dashboard', label: 'Tableau de bord', icon: 'fa-solid fa-gauge-high' },
          { to: '/analytique', label: 'Analytique', icon: 'fa-solid fa-chart-line' },
          { to: '/saisie', label: 'Calendrier', icon: 'fa-solid fa-calendar-days' },
          { to: '/saisie-rapide', label: 'Saisie longue période', icon: 'fa-solid fa-pen-to-square' },
        ],
      },
      {
        label: 'Catalogue',
        icon: 'fa-solid fa-box-open',
        items: [
          { to: '/articles', label: 'Articles', icon: 'fa-solid fa-box' },
          { to: '/materials', label: 'Matières', icon: 'fa-solid fa-wheat-awn' },
          { to: '/factures', label: 'Factures', icon: 'fa-solid fa-file-invoice' },
        ],
      },
      {
        label: 'Commercial',
        icon: 'fa-solid fa-handshake',
        items: [
          { to: '/clients', label: 'Clients', icon: 'fa-solid fa-users' },
          { to: '/billing', label: 'Facturation', icon: 'fa-solid fa-file-invoice-dollar' },
          { to: '/communication', label: 'Communication', icon: 'fa-solid fa-bullhorn' },
        ],
      },
      {
        label: 'Organisation',
        icon: 'fa-solid fa-sitemap',
        items: [
          { to: '/etablissements', label: 'Établissements', icon: 'fa-solid fa-store' },
          { to: '/employees', label: 'Équipe', icon: 'fa-solid fa-user-group' },
        ],
      },
    ]
  }
  if (isEmploye(me))
    return [{ label: '', items: [{ to: '/saisie', label: 'Calendrier', icon: 'fa-solid fa-calendar-days' }] }]
  return []
}

/** Onglet déroulant (desktop) regroupant plusieurs liens. */
function NavMenu({ group }: { group: NavGroup }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const loc = useLocation()
  const active = group.items.some((it) => loc.pathname === it.to || loc.pathname.startsWith(it.to + '/'))
  return (
    <>
      <Button
        color="inherit"
        startIcon={group.icon ? <FaIcon icon={group.icon} sx={{ color: active ? 'primary.main' : 'text.secondary' }} /> : undefined}
        endIcon={<ExpandMoreIcon />}
        onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
        sx={{
          px: 1.5,
          fontWeight: active ? 700 : 500,
          color: active ? 'primary.main' : 'text.primary',
          bgcolor: active ? alpha('#ea580c', 0.1) : 'transparent',
          '&:hover': { bgcolor: alpha('#ea580c', 0.08) },
        }}
      >
        {group.label}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 220 } } }}
      >
        {group.items.map((it) => (
          <MenuItem
            key={it.to}
            component={NavLink}
            to={it.to}
            onClick={() => setAnchor(null)}
            sx={{
              gap: 1.25,
              '& i': { color: 'text.secondary' },
              '&.active': { color: 'primary.main', fontWeight: 600 },
              '&.active i': { color: 'primary.main' },
            }}
          >
            {it.icon && <FaIcon icon={it.icon} />}
            {it.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

/** Lien de nav stylé pour la barre horizontale (desktop). */
function NavTab({ to, label, icon }: NavItem) {
  return (
    <Button
      component={NavLink}
      to={to}
      color="inherit"
      startIcon={icon ? <FaIcon icon={icon} /> : undefined}
      sx={{
        px: 1.5,
        fontWeight: 500,
        color: 'text.primary',
        '&.active': {
          bgcolor: 'background.default',
          color: 'primary.main',
          fontWeight: 600,
        },
      }}
    >
      {label}
    </Button>
  )
}

export function Layout() {
  const { me, logout, exitImpersonation } = useAuth()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null)
  // Réglages contextuels injectés par la page courante (affichés dans la roue crantée).
  const [pageSettings, setPageSettings] = useState<HeaderSettings | null>(null)
  const { baseline, setBaseline } = useSettings()

  if (!me) return null

  const groups = navGroupsFor(me)
  // Accueil = 1re entrée de nav du rôle (Tableau de bord pour un patron, Tenants pour l'admin…).
  const homePath = groups[0]?.items[0]?.to ?? '/'

  const onLogout = () => {
    logout()
    navigate('/login')
  }
  const onExitImpersonation = async () => {
    await exitImpersonation()
    navigate('/admin/tenants')
  }

  const impersonating = me.impersonatedBy != null

  return (
    <Box sx={{ minHeight: '100dvh' }}>

      <AppBar position="static">
        <Toolbar sx={{ gap: 2, minHeight: { xs: 64, md: 88 } }}>
          {isMobile && (
            <IconButton edge="start" aria-label="Menu" onClick={() => setMenuOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <Box
            role="button"
            tabIndex={0}
            aria-label="Argéneo — accueil"
            onClick={() => navigate(homePath)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') navigate(homePath)
            }}
            sx={{ display: 'inline-flex', cursor: 'pointer' }}
          >
            <BrandLogo height={isMobile ? 34 : 44} />
          </Box>

          {!isMobile && (
            <Stack direction="row" spacing={0.5} sx={{ flex: 1 }}>
              {groups.map((g) =>
                g.label ? (
                  <NavMenu key={g.label} group={g} />
                ) : (
                  g.items.map((it) => <NavTab key={it.to} {...it} />)
                ),
              )}
            </Stack>
          )}

          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, ml: 'auto' }}>
            {!isMobile && (
              <>
                <Typography variant="body2">{me.fullName}</Typography>
                {impersonating ? (
                  <Tooltip title="Quitter le mode support">
                    <Chip
                      icon={<SupportAgentIcon />}
                      label="Mode support"
                      color="warning"
                      size="small"
                      onDelete={onExitImpersonation}
                      deleteIcon={<LogoutIcon />}
                    />
                  </Tooltip>
                ) : (
                  <Chip label={roleLabel(me)} size="small" variant="outlined" />
                )}
              </>
            )}
            <Tooltip title="Rafraîchir la page">
              <IconButton aria-label="Rafraîchir" onClick={() => window.location.reload()}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Réglages">
              <IconButton aria-label="Réglages" onClick={(e) => setSettingsAnchor(e.currentTarget)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            {isMobile ? (
              <Tooltip title="Déconnexion">
                <IconButton aria-label="Déconnexion" onClick={onLogout}>
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Button variant="outlined" color="inherit" startIcon={<LogoutIcon />} onClick={onLogout}>
                Déconnexion
              </Button>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      <Popover
        open={Boolean(settingsAnchor)}
        anchorEl={settingsAnchor}
        onClose={() => setSettingsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, maxWidth: 320, minWidth: 250 }}>
          <Typography variant="subtitle2" gutterBottom>
            Réglages
          </Typography>
          {/* Réglages spécifiques à la page courante (injectés via le contexte). */}
          {pageSettings?.content && (
            <Box sx={{ mb: 1.5 }}>
              {pageSettings.content}
              {!pageSettings.hideGlobal && <Divider sx={{ mt: 1.5 }} />}
            </Box>
          )}
          {/* Réglages globaux (base IA) — masqués si la page le demande. */}
          {!pageSettings?.hideGlobal && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Base des pourcentages des conseils IA
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={baseline}
                onChange={(_, v) => {
                  if (v) setBaseline(v)
                }}
                aria-label="Base de calcul de l'IA"
              >
                <ToggleButton value="habituel">vs jour normal</ToggleButton>
                <ToggleButton value="n1">vs N-1</ToggleButton>
              </ToggleButtonGroup>
            </>
          )}
        </Box>
      </Popover>

      <Drawer anchor="left" open={isMobile && menuOpen} onClose={() => setMenuOpen(false)}>
        <Box sx={{ width: 260 }} role="presentation" onClick={() => setMenuOpen(false)}>
          {/* En-tête : utilisateur connecté (masqué dans la barre sur mobile). */}
          <Box sx={{ px: 2, py: 2, bgcolor: 'background.default' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
              {me.fullName}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
              {me.email}
            </Typography>
            <Chip
              label={impersonating ? 'Mode support' : roleLabel(me)}
              color={impersonating ? 'warning' : 'default'}
              size="small"
              variant="outlined"
              sx={{ mt: 1 }}
            />
          </Box>
          <Divider />
          {impersonating && (
            <>
              <ListItemButton onClick={onExitImpersonation} sx={{ color: 'warning.main' }}>
                <SupportAgentIcon fontSize="small" sx={{ mr: 1 }} />
                Quitter le mode support
              </ListItemButton>
              <Divider />
            </>
          )}
          <List>
            {groups.map((g) => (
              <Box key={g.label || 'main'}>
                {g.label && (
                  <ListSubheader
                    sx={{
                      bgcolor: 'transparent',
                      lineHeight: '34px',
                      color: 'text.secondary',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      fontSize: '0.7rem',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {g.label}
                  </ListSubheader>
                )}
                {g.items.map((it) => (
                  <ListItemButton
                    key={it.to}
                    component={NavLink}
                    to={it.to}
                    sx={{
                      pl: g.label ? 3 : 2,
                      gap: 1.5,
                      '& i': { color: 'text.secondary' },
                      '&.active': { color: 'primary.main', fontWeight: 600, bgcolor: alpha('#ea580c', 0.1) },
                      '&.active i': { color: 'primary.main' },
                    }}
                  >
                    {it.icon && <FaIcon icon={it.icon} sx={{ fontSize: 16 }} />}
                    {it.label}
                  </ListItemButton>
                ))}
              </Box>
            ))}
          </List>
        </Box>
      </Drawer>

      <Container component="main" maxWidth="lg" sx={{ py: 4 }}>
        <HeaderSettingsContext.Provider value={setPageSettings}>
          <Outlet />
        </HeaderSettingsContext.Provider>
      </Container>
    </Box>
  )
}
