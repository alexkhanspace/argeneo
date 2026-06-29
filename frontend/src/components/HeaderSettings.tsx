import { createContext, useContext, type ReactNode } from 'react'

/**
 * Permet à la page courante d'injecter des réglages *contextuels* dans la roue crantée
 * du header (en plus des réglages globaux). La page enregistre son contenu via le setter
 * et le retire à son démontage.
 */
export type HeaderSettingsSetter = (node: ReactNode) => void

export const HeaderSettingsContext = createContext<HeaderSettingsSetter>(() => {})

export function useHeaderSettingsSetter(): HeaderSettingsSetter {
  return useContext(HeaderSettingsContext)
}
