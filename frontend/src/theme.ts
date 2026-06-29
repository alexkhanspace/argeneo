import { createTheme } from '@mui/material/styles'
import { frFR as coreFrFR } from '@mui/material/locale'
import { frFR as dataGridFrFR } from '@mui/x-data-grid/locales'

/**
 * Thème Argéneo — refonte « flat 2026 ».
 * Identité chaude conservée (accent terracotta) mais exécution modernisée :
 * surfaces plates (bordures fines, pas d'ombres lourdes), coins peu arrondis,
 * typographie Inter, contrastes nets. Tout l'UI hérite de ces tokens.
 */
const ink = '#18181b' // quasi-noir (zinc 900)
const muted = '#6b7280' // gris 500
const line = '#ece9e4' // hairline légèrement chaude (s'accorde à la terracotta)
const lineStrong = '#ddd8d0' // bordure un cran plus marquée (champs, états hover)
const bg = '#f7f6f4' // blanc cassé très léger (fini le crème)
const surface = '#ffffff'
const accent = '#c2410c' // terracotta modernisée (plus franche)
const accentDark = '#9a3412'

// Thème de base : palette + points de rupture, réutilisés ensuite pour la
// typographie responsive (on a besoin de `base.breakpoints`).
const base = createTheme({
  palette: {
    mode: 'light',
    primary: { main: accent, dark: accentDark, contrastText: '#ffffff' },
    secondary: { main: '#0f766e', contrastText: '#ffffff' },
    error: { main: '#dc2626' },
    warning: { main: '#d97706' },
    success: { main: '#16a34a' },
    info: { main: '#2563eb' },
    background: { default: bg, paper: surface },
    text: { primary: ink, secondary: muted },
    divider: line,
  },
  shape: { borderRadius: 6 }, // moins arrondi qu'avant (10) → plus « flat »
})

const { breakpoints } = base

export const theme = createTheme(
  base,
  {
    typography: {
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      // Mobile-first : tailles compactes sur xs, agrandies à partir de sm.
      h1: {
        fontSize: '1.45rem',
        fontWeight: 800,
        letterSpacing: '-0.025em',
        [breakpoints.up('sm')]: { fontSize: '1.9rem' },
      },
      h2: {
        fontSize: '1.1rem',
        fontWeight: 700,
        letterSpacing: '-0.015em',
        [breakpoints.up('sm')]: { fontSize: '1.25rem' },
      },
      h3: {
        fontSize: '0.72rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: muted,
        [breakpoints.up('sm')]: { fontSize: '0.76rem' },
      },
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.015em' },
      h6: {
        fontSize: '1.05rem',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        [breakpoints.up('sm')]: { fontSize: '1.25rem' },
      },
      subtitle2: { fontWeight: 600, letterSpacing: '0.01em' },
      body1: {
        fontSize: '0.9rem',
        [breakpoints.up('sm')]: { fontSize: '0.95rem' },
      },
      caption: { letterSpacing: '0.01em' },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' },
          body: { backgroundColor: bg },
          // Barre de défilement discrète, raccord avec le côté épuré.
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: lineStrong,
            borderRadius: 8,
            border: `2px solid ${bg}`,
          },
          '*::-webkit-scrollbar-thumb:hover': { backgroundColor: muted },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: line },
          // Plus d'ombres « MUI » par défaut : on reste flat.
          elevation1: { boxShadow: 'none' },
        },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            border: `1px solid ${line}`,
            borderRadius: 8,
            boxShadow: 'none', // flat : la carte est définie par sa bordure, pas par une ombre
            transition: 'border-color 120ms ease, background-color 120ms ease',
          },
        },
      },
      MuiAppBar: {
        defaultProps: { color: 'inherit', elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(255,255,255,0.85)',
            backdropFilter: 'saturate(180%) blur(8px)',
            borderBottom: `1px solid ${line}`,
            boxShadow: 'none',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: true },
        styleOverrides: {
          root: { borderRadius: 6, paddingInline: 14 },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none', backgroundColor: accentDark },
          },
          outlined: { borderColor: lineStrong, '&:hover': { borderColor: muted, backgroundColor: 'rgba(0,0,0,0.02)' } },
        },
      },
      MuiIconButton: {
        defaultProps: { disableRipple: true },
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 500 },
          outlined: { borderColor: lineStrong },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          grouped: { borderColor: lineStrong },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            textTransform: 'none',
            fontWeight: 600,
            borderColor: lineStrong,
            color: ink,
            '&.Mui-selected': {
              backgroundColor: accent,
              color: '#ffffff',
              '&:hover': { backgroundColor: accentDark },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            backgroundColor: surface,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: lineStrong },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: muted },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent, borderWidth: 1 },
          },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small', fullWidth: true },
      },
      // iOS Safari zoome automatiquement au focus d'un champ dont la police < 16px.
      // On force 16px sur mobile pour empêcher ce zoom (le pinch-to-zoom reste possible).
      MuiInputBase: {
        styleOverrides: {
          input: {
            [breakpoints.down('sm')]: { fontSize: '16px' },
          },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: line } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: line },
          head: {
            color: muted,
            fontWeight: 600,
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: ink, fontSize: '0.75rem', borderRadius: 6, paddingBlock: 6 },
          arrow: { color: ink },
        },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: 8 } },
      },
    },
  },
  coreFrFR,
  dataGridFrFR,
) // locales FR fusionnées : composants MUI + DataGrid en français
