import { api } from './client'

// --- Types ---
export type ClientKind = 'PRO' | 'PARTICULIER'
export type DocumentType = 'DEVIS' | 'FACTURE'
export type DocumentStatus = 'BROUILLON' | 'EMIS' | 'ACCEPTE' | 'REFUSE' | 'PAYE' | 'ANNULE'

export interface Client {
  id: number
  name: string
  kind: ClientKind
  siret: string | null
  tvaIntra: string | null
  email: string | null
  phone: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  active: boolean
}

export interface ClientInput {
  name: string
  kind: ClientKind
  siret?: string | null
  tvaIntra?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  active?: boolean
}

export interface BillingProfile {
  id: number | null
  etablissementId: number | null
  siren: string | null
  siret: string | null
  tvaIntra: string | null
  rcs: string | null
  ape: string | null
  legalForm: string | null
  shareCapital: number | null
  iban: string | null
  bic: string | null
  contactEmail: string | null
  contactPhone: string | null
  logoFile: string | null
}

export type BillingProfileInput = Omit<BillingProfile, 'id' | 'etablissementId' | 'logoFile'>

export interface BillingSettings {
  id: number | null
  etablissementId: number | null
  legalMentions: string | null
  paymentTermsDays: number | null
  latePenalty: string | null
  footer: string | null
  /** Couleurs de marque (3 max) pour coloriser les PDF (hex #RRGGBB). */
  brandColor1: string | null
  brandColor2: string | null
  brandColor3: string | null
}

export type BillingSettingsInput = Omit<BillingSettings, 'id' | 'etablissementId'>

export interface BillingLine {
  id?: number
  position?: number
  designation: string
  articleId?: number | null
  quantity: number
  unit?: string | null
  unitPriceHt: number
  vatRate: number
  discountRate: number
  lineTotalHt?: number
}

export interface BillingDocument {
  id: number
  type: DocumentType
  number: string | null
  status: DocumentStatus
  clientId: number
  clientName: string | null
  issueDate: string | null
  dueDate: string | null
  currency: string
  totalHt: number
  totalVat: number
  totalTtc: number
  notes: string | null
  terms: string | null
  lines: BillingLine[]
}

export interface DocumentInput {
  clientId: number
  issueDate?: string | null
  dueDate?: string | null
  notes?: string | null
  terms?: string | null
  lines: BillingLine[]
}

// --- Clients ---
export async function listClients(): Promise<Client[]> {
  const { data } = await api.get<Client[]>('/clients')
  return data
}

export async function createClient(input: ClientInput): Promise<Client> {
  const { data } = await api.post<Client>('/clients', input)
  return data
}

export async function updateClient(id: number, input: ClientInput): Promise<Client> {
  const { data } = await api.put<Client>(`/clients/${id}`, input)
  return data
}

export async function deactivateClient(id: number): Promise<void> {
  await api.delete(`/clients/${id}`)
}

// --- Profil émetteur ---
export async function getProfile(): Promise<BillingProfile> {
  const { data } = await api.get<BillingProfile>('/billing/profile')
  return data
}

export async function saveProfile(input: BillingProfileInput): Promise<BillingProfile> {
  const { data } = await api.put<BillingProfile>('/billing/profile', input)
  return data
}

/** Upload du logo de l'émetteur (multipart). */
export async function uploadBillingLogo(file: File): Promise<BillingProfile> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<BillingProfile>('/billing/profile/logo', form)
  return data
}

/** URL publique du logo (servi par /api/media/{file}). */
export function logoUrl(file: string | null): string | null {
  return file ? `/api/media/${file}` : null
}

/** Récupère le PDF (Factur-X pour une facture) d'un document sous forme de blob. */
export async function fetchDocumentPdf(id: number): Promise<Blob> {
  const res = await api.get(`/billing/documents/${id}/pdf`, { responseType: 'blob' })
  return res.data as Blob
}

// --- Paramètres & mentions ---
export async function getSettings(): Promise<BillingSettings> {
  const { data } = await api.get<BillingSettings>('/billing/settings')
  return data
}

export async function saveSettings(input: BillingSettingsInput): Promise<BillingSettings> {
  const { data } = await api.put<BillingSettings>('/billing/settings', input)
  return data
}

// --- Documents ---
export async function listDocuments(type?: DocumentType): Promise<BillingDocument[]> {
  const { data } = await api.get<BillingDocument[]>('/billing/documents', {
    params: type ? { type } : undefined,
  })
  return data
}

export async function getDocument(id: number): Promise<BillingDocument> {
  const { data } = await api.get<BillingDocument>(`/billing/documents/${id}`)
  return data
}

export async function createDocument(
  type: DocumentType,
  input: DocumentInput,
): Promise<BillingDocument> {
  const { data } = await api.post<BillingDocument>('/billing/documents', { type, ...input })
  return data
}

export async function updateDocument(id: number, input: DocumentInput): Promise<BillingDocument> {
  const { data } = await api.put<BillingDocument>(`/billing/documents/${id}`, input)
  return data
}

export async function deleteDocument(id: number): Promise<void> {
  await api.delete(`/billing/documents/${id}`)
}

export async function setDocumentStatus(
  id: number,
  status: DocumentStatus,
): Promise<BillingDocument> {
  const { data } = await api.post<BillingDocument>(`/billing/documents/${id}/status`, { status })
  return data
}

export async function convertToFacture(id: number): Promise<BillingDocument> {
  const { data } = await api.post<BillingDocument>(`/billing/documents/${id}/convert`)
  return data
}

// --- Helpers d'affichage ---
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  BROUILLON: 'Brouillon',
  EMIS: 'Émis',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  PAYE: 'Payé',
  ANNULE: 'Annulé',
}

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  PRO: 'Professionnel',
  PARTICULIER: 'Particulier',
}
