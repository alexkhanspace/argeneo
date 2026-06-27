import { api } from './client'
import type { InvoiceApplyLine, InvoiceDetail, InvoiceSummary } from './types'

// --- Factures fournisseurs ---
export async function listInvoices(): Promise<InvoiceSummary[]> {
  const { data } = await api.get<InvoiceSummary[]>('/supplier-invoices')
  return data
}

export async function getInvoice(id: number): Promise<InvoiceDetail> {
  const { data } = await api.get<InvoiceDetail>(`/supplier-invoices/${id}`)
  return data
}

/** Scanne une facture (photo ou PDF) : l'IA extrait les lignes, on persiste un brouillon. */
export async function scanInvoice(file: File, etablissementId?: number | null): Promise<InvoiceDetail> {
  const form = new FormData()
  form.append('file', file)
  if (etablissementId != null) form.append('etablissementId', String(etablissementId))
  const { data } = await api.post<InvoiceDetail>('/supplier-invoices/scan', form)
  return data
}

export async function applyInvoice(id: number, lines: InvoiceApplyLine[]): Promise<InvoiceDetail> {
  const { data } = await api.post<InvoiceDetail>(`/supplier-invoices/${id}/apply`, { lines })
  return data
}

export async function deleteInvoice(id: number): Promise<void> {
  await api.delete(`/supplier-invoices/${id}`)
}

/** Récupère le fichier scanné (authentifié) comme blob, pour aperçu/ouverture. */
export async function getInvoiceFile(id: number): Promise<Blob> {
  const { data } = await api.get(`/supplier-invoices/${id}/file`, { responseType: 'blob' })
  return data as Blob
}
