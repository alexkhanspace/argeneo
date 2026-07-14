import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Baseline } from '../api/insights'

/** Réglages utilisateur (persistés en localStorage), partagés par toute l'app. */
interface Settings {
  /** Axe de comparaison global (IA + analytique) : jour normal, N-1 même jour, N-1 même date. */
  baseline: Baseline
  setBaseline: (b: Baseline) => void
}

const KEY = 'argeneo.iaBaseline'

const SettingsContext = createContext<Settings | null>(null)

/** Lit le réglage persisté en migrant l'ancienne valeur « n1 » vers « n1_equiv ». */
function readBaseline(): Baseline {
  const v = localStorage.getItem(KEY)
  if (v === 'n1_date') return 'n1_date'
  if (v === 'n1_equiv' || v === 'n1') return 'n1_equiv'
  return 'habituel'
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [baseline, setBaselineState] = useState<Baseline>(readBaseline)
  const setBaseline = (b: Baseline) => {
    localStorage.setItem(KEY, b)
    setBaselineState(b)
  }
  return (
    <SettingsContext.Provider value={{ baseline, setBaseline }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings doit être utilisé dans un SettingsProvider')
  return ctx
}
