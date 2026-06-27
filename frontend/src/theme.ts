import { createTheme } from '@mui/material/styles'
import { frFR as coreFrFR } from '@mui/material/locale'
import { frFR as dataGridFrFR } from '@mui/x-data-grid/locales'

/**
 * Thème Argéneo — rejoue la palette « chaude » de l'ancien index.css
 * (brun terre #b5651d, fond crème, lignes sable) dans le système MUI.
 * Tout l'UI hérite de ces tokens : pas de CSS maison à maintenir en double.
 */
const ink = '#2a2622'
const muted = '#8a8178'
const line = '#e7e1d8'
const bg = '#f5f3ef'
const surface = '#ffffff'

// Thème de base : palette + points de rupture, réutilisés ensuite pour la
// typographie responsive (on a besoin de `base.breakpoints`).
const base = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#b5651d', dark: '#9a5417', contrastText: '#ffffff' },
    error: { main: '#b3261e' },
    success: { main: '#2e7d32' },
    background: { default: bg, paper: surface },
    text: { primary: ink, secondary: muted },
    divider: line,
  },
  shape: { borderRadius: 10 },
})

const { breakpoints } = base

export const theme = createTheme(base, {
  typography: {
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    // Mobile-first : tailles compactes sur xs, agrandies à partir de sm.
    h1: {
      fontSize: '1.3rem',
      fontWeight: 700,
      letterSpacing: '-0.01em',
      [breakpoints.up('sm')]: { fontSize: '1.6rem' },
    },
    h2: {
      fontSize: '1.05rem',
      fontWeight: 700,
      [breakpoints.up('sm')]: { fontSize: '1.15rem' },
    },
    h3: {
      fontSize: '0.8rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: muted,
      [breakpoints.up('sm')]: { fontSize: '0.85rem' },
    },
    h6: {
      fontSize: '1.05rem',
      fontWeight: 700,
      [breakpoints.up('sm')]: { fontSize: '1.25rem' },
    },
    body1: {
      fontSize: '0.9rem',
      [breakpoints.up('sm')]: { fontSize: '1rem' },
    },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        // Cartes : bordure fine + ombre douce, comme l'ancien .card.
        outlined: { borderColor: line },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          borderColor: line,
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiAppBar: {
      defaultProps: { color: 'inherit', elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: surface,
          borderBottom: `1px solid ${line}`,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiTextField: {
      defaultProps: { size: 'small', fullWidth: true },
    },
    // iOS Safari zoome automatiquement au focus d'un champ dont la police < 16px.
    // On force 16px sur mobile (inputs, selects, textareas) pour empêcher ce zoom
    // intempestif — le pinch-to-zoom manuel reste possible (accessibilité préservée).
    MuiInputBase: {
      styleOverrides: {
        input: {
          [breakpoints.down('sm')]: { fontSize: '16px' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { color: muted, fontWeight: 600, fontSize: '0.8rem' },
      },
    },
  },
}, coreFrFR, dataGridFrFR) // locales FR fusionnées : composants MUI + DataGrid en français
