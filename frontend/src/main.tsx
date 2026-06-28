import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { SettingsProvider } from './settings/SettingsContext'
import { theme } from './theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)

// PWA : enregistrer le service worker (en production uniquement, pour ne pas
// interférer avec le HMR de Vite en dev). Auto-update : dès qu'une nouvelle version
// prend la main, on recharge une fois pour servir le dernier bundle (fini le cache figé).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing || !hadController) return
      refreshing = true
      window.location.reload()
    })
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.update().catch(() => undefined)
        // Vérifie les mises à jour à chaque retour sur l'onglet.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => undefined)
        })
      })
      .catch(() => undefined)
  })
}
