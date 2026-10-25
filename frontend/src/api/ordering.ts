import { api } from './client'

/** Permission employé requise pour commander sur un établissement. */
export const ORDER_PERMISSION = 'passer_commande'

// --- Cadenciers (modèles de bon de commande par fournisseur) ---

export interface SheetLine {
  /** null pour une ligne pas encore enregistrée (import, ajout). */
  id: number | null
  section: string | null
  code: string | null
  designation: string
  designationAlt: string | null
  packaging: string | null
  unitPrice: number | null
  priceUnit: string | null
  rawMaterialId: number | null
}

export interface SheetSummary {
  id: number
  name: string
  supplierName: string | null
  active: boolean
  lineCount: number
  updatedAt: string
}

export interface OrderSheet {
  id: number
  name: string
  supplierName: string | null
  supplierEmail: string | null
  supplierPhone: string | null
  notes: string | null
  color: string | null
  showPrices: boolean
  active: boolean
  updatedAt: string
  lines: SheetLine[]
}

export type SheetInput = Omit<OrderSheet, 'id' | 'updatedAt'>

export interface SheetScanResult {
  name: string | null
  supplierName: string | null
  pageCount: number
  lines: SheetLine[]
}

export async function listSheets(): Promise<SheetSummary[]> {
  const { data } = await api.get<SheetSummary[]>('/order-sheets')
  return data
}

export async function getSheet(id: number): Promise<OrderSheet> {
  const { data } = await api.get<OrderSheet>(`/order-sheets/${id}`)
  return data
}

export async function createSheet(input: SheetInput): Promise<OrderSheet> {
  const { data } = await api.post<OrderSheet>('/order-sheets', input)
  return data
}

export async function updateSheet(id: number, input: SheetInput): Promise<OrderSheet> {
  const { data } = await api.put<OrderSheet>(`/order-sheets/${id}`, input)
  return data
}

export async function deleteSheet(id: number): Promise<void> {
  await api.delete(`/order-sheets/${id}`)
}

/** Lit UNE page de cadencier (photo ou PDF) par IA. Rien n'est enregistré côté serveur. */
export async function scanSheetPage(file: File): Promise<SheetScanResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<SheetScanResult>('/order-sheets/scan', form, { timeout: 180_000 })
  return data
}

// --- Commandes ---

export type OrderStatus = 'BROUILLON' | 'VALIDEE'

export interface OrderLine {
  id: number
  sheetLineId: number | null
  section: string | null
  code: string | null
  designation: string
  packaging: string | null
  unitPrice: number | null
  priceUnit: string | null
  quantity: number
}

export interface OrderSummary {
  id: number
  sheetId: number | null
  sheetName: string
  supplierName: string | null
  etablissementId: number | null
  etablissementName: string | null
  orderDate: string
  deliveryDate: string | null
  status: OrderStatus
  lineCount: number
  totalAmount: number | null
  createdByName: string | null
  createdAt: string
}

export interface PurchaseOrder extends Omit<OrderSummary, 'lineCount'> {
  notes: string | null
  validatedAt: string | null
  lines: OrderLine[]
}

export interface OrderLineInput {
  sheetLineId: number | null
  designation?: string | null
  packaging?: string | null
  quantity: number
}

export interface OrderInput {
  sheetId: number
  etablissementId: number
  orderDate?: string | null
  deliveryDate?: string | null
  notes?: string | null
  validate?: boolean
  lines: OrderLineInput[]
}

export async function listOrders(): Promise<OrderSummary[]> {
  const { data } = await api.get<OrderSummary[]>('/purchase-orders')
  return data
}

export async function getOrder(id: number): Promise<PurchaseOrder> {
  const { data } = await api.get<PurchaseOrder>(`/purchase-orders/${id}`)
  return data
}

export async function createOrder(input: OrderInput): Promise<PurchaseOrder> {
  const { data } = await api.post<PurchaseOrder>('/purchase-orders', input)
  return data
}

export async function updateOrder(id: number, input: OrderInput): Promise<PurchaseOrder> {
  const { data } = await api.put<PurchaseOrder>(`/purchase-orders/${id}`, input)
  return data
}

export async function reopenOrder(id: number): Promise<PurchaseOrder> {
  const { data } = await api.post<PurchaseOrder>(`/purchase-orders/${id}/reopen`)
  return data
}

export async function deleteOrder(id: number): Promise<void> {
  await api.delete(`/purchase-orders/${id}`)
}
