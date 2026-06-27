import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Baseline } from '../api/insights'

/** Réglages utilisateur (persistés en localStorage), partagés par toute l'app. */
interface Settings {
  /** Base de calcul des pourcentages de l'IA : journée habituelle ou N-1. */
  baseline: Baseline
  setBaseline: (b: Baseline) => void
}

const KEY = 'argeneo.iaBaseline'

const SettingsContext = createContext<Settings | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [baseline, setBaselineState] = useState<Baseline>(() =>
    localStorage.getItem(KEY) === 'n1' ? 'n1' : 'habituel',
  )
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
