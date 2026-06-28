import { api } from './client'

export type WidgetSize = 'S' | 'M' | 'L'
export interface DashboardItem {
  type: string
  size: WidgetSize
}
export interface DashboardConfig {
  items: DashboardItem[]
}

/** Tableau de bord personnalisé du compte courant (null si jamais configuré). */
export async function getDashboard(): Promise<DashboardConfig | null> {
  const { data } = await api.get<{ layout: string | null }>('/me/dashboard')
  if (!data.layout) return null
  try {
    const parsed = JSON.parse(data.layout) as DashboardConfig
    return Array.isArray(parsed.items) ? parsed : null
  } catch {
    return null
  }
}

export async function saveDashboard(config: DashboardConfig): Promise<void> {
  await api.put('/me/dashboard', { layout: JSON.stringify(config) })
}
