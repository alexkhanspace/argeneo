import { createContext, useContext, type ReactNode } from 'react'

/**
 * Permet à la page courante d'injecter des réglages *contextuels* dans la roue crantée
 * du header. La page enregistre son contenu via le setter et le retire à son démontage.
 * `hideGlobal` masque les réglages globaux (p. ex. la base IA) quand ils n'ont pas de sens
 * sur la page.
 */
export interface HeaderSettings {
  content: ReactNode
  hideGlobal?: boolean
}

export type HeaderSettingsSetter = (settings: HeaderSettings | null) => void

export const HeaderSettingsContext = createContext<HeaderSettingsSetter>(() => {})

export function useHeaderSettingsSetter(): HeaderSettingsSetter {
  return useContext(HeaderSettingsContext)
}
