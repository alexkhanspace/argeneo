import { api } from './client'
import type { AuditEvent } from './types'

/** Historique d'usage de la plateforme (réservé Super-Admin). */
export async function listAudit(params?: {
  tenantId?: number
  limit?: number
}): Promise<AuditEvent[]> {
  const { data } = await api.get<AuditEvent[]>('/admin/audit', { params })
  return data
}
