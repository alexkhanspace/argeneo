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
  /** true : date de livraison choisie à la commande (ex. farine) ; sinon jours fixes. */
  deliveryDateChoice: boolean
  /** Jours habituels de livraison, ISO (1 = lundi … 7 = dimanche), ex. « 2,5 ». */
  deliveryDays: string | null
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

export type OrderStatus = 'BROUILLON' | 'VALIDEE' | 'RECUE'

export const STATUS_LABEL: Record<OrderStatus, string> = { BROUILLON: 'Brouillon', VALIDEE: 'Validée', RECUE: 'Reçue' }
export const STATUS_COLOR: Record<OrderStatus, 'default' | 'success' | 'info'> = {
  BROUILLON: 'default',
  VALIDEE: 'info',
  RECUE: 'success',
}

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
  /** Livraison attendue : date demandée, sinon prochain jour de livraison du fournisseur. */
  expectedDate: string | null
  receivedAt: string | null
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

/** Pointe la réception d'une commande (ou l'annule avec received = false). */
export async function receiveOrder(id: number, received = true): Promise<PurchaseOrder> {
  const { data } = await api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`, null, { params: { received } })
  return data
}

const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

/** « 2,5 » → « mardi, vendredi » (null si aucun jour). */
export function deliveryDaysLabel(days: string | null | undefined): string | null {
  const list = (days ?? '')
    .split(',')
    .map((d) => Number(d))
    .filter((d) => d >= 1 && d <= 7)
  return list.length ? list.map((d) => DAY_NAMES[d - 1]).join(', ') : null
}

export async function deleteOrder(id: number): Promise<void> {
  await api.delete(`/purchase-orders/${id}`)
}
