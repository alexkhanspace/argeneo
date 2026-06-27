export type PrincipalType = 'ADMIN' | 'USER'
export type UserRole = 'PATRON' | 'EMPLOYE'
export type RecipeScope = 'ENSEIGNE' | 'ETABLISSEMENT'

export interface LoginResponse {
  token: string
  expiresInSeconds: number
  email: string
  fullName: string
  type: PrincipalType
  role: UserRole | null
  tenantId: number | null
}

export interface Me {
  id: number
  email: string
  fullName: string
  type: PrincipalType
  role: UserRole | null
  tenantId: number | null
  impersonatedBy: number | null
  authorities: string[]
}

export interface Tenant {
  id: number
  name: string
  recipeScope: RecipeScope
  active: boolean
  createdAt: string
}

export interface Etablissement {
  id: number
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
  active: boolean
}

export interface AppUser {
  id: number
  email: string
  fullName: string
  role: UserRole
  active: boolean
}

export interface Permission {
  code: string
  label: string
  category: string
}

export interface Preset {
  code: string
  label: string
  permissionCodes: string[]
}

export interface EtablissementPermissions {
  etablissementId: number
  permissionCodes: string[]
}

export interface UserPermissions {
  userId: number
  etablissements: EtablissementPermissions[]
}

export interface AdminUserRow {
  kind: 'ADMIN' | 'USER'
  id: number
  email: string
  fullName: string
  role: 'SUPER_ADMIN' | 'PATRON' | 'EMPLOYE'
  tenantId: number | null
  tenantName: string | null
  active: boolean
}

// --- Historique d'usage (audit, consultable par le Super-Admin) ---
export interface AuditEvent {
  id: number
  occurredAt: string
  actorType: 'ADMIN' | 'USER' | null
  actorEmail: string | null
  tenantId: number | null
  tenantName: string | null
  action: string
  targetType: string | null
  targetId: string | null
  summary: string | null
}

// --- Costing (matières, articles, recettes, PNET) ---
export type MeasureUnit = 'G' | 'KG' | 'ML' | 'L' | 'PIECE'
export type MeasureDimension = 'MASS' | 'VOLUME' | 'PIECE'
export type ArticleType = 'ACHAT_REVENTE' | 'FABRIQUE' | 'MENU'
export type ComponentType = 'RAW' | 'SUBRECIPE'

export interface UnitInfo {
  code: MeasureUnit
  dimension: MeasureDimension
}

// --- Familles / sous-familles (référentiel de classement, séparé par périmètre) ---
export type FamilleScope = 'ARTICLE' | 'RAW_MATERIAL'

/** Famille avec ses sous-familles imbriquées (arborescence à deux niveaux). */
export interface Famille {
  id: number
  name: string
  position: number
  children: Famille[]
}

export interface RawMaterial {
  id: number
  name: string
  referenceUnit: MeasureUnit
  pricePerUnit: number
  familleId: number | null
  familleName: string | null
  sousFamilleId: number | null
  sousFamilleName: string | null
  active: boolean
}

export interface Article {
  id: number
  code: string
  name: string
  type: ArticleType
  unit: MeasureUnit
  salePriceTtc: number | null
  salePriceHt: number | null
  vatRate: number | null
  purchasePrice: number | null
  gtin: string | null
  photoFile: string | null
  description: string | null
  familleId: number | null
  familleName: string | null
  sousFamilleId: number | null
  sousFamilleName: string | null
  active: boolean
  hasRecipe: boolean
}

export interface RecipeComponent {
  id?: number
  type: ComponentType
  rawMaterialId: number | null
  subArticleId: number | null
  label?: string
  quantity: number
  unit: MeasureUnit
}

export interface Recipe {
  articleId: number
  yieldQuantity: number
  yieldUnit: MeasureUnit
  lossRate: number
  method: string | null
  durationMinutes: number | null
  components: RecipeComponent[]
  steps: string[]
}

export interface PnetLine {
  label: string
  type: ComponentType
  refId: number
  quantity: number
  unit: MeasureUnit
  lineCost: number
}

export interface Pnet {
  articleId: number
  articleName: string
  type: ArticleType
  unitCost: number
  unit: MeasureUnit
  batchCost: number
  effectiveYield: number
  yieldUnit: MeasureUnit
  lines: PnetLine[]
  salePriceTtc?: number | null
  salePriceHt?: number | null
  vatRate?: number | null
  marginHt?: number | null
  markupRate?: number | null
  marginRate?: number | null
  coefficient?: number | null
}

// --- Factures fournisseurs (scan IA → revue → mise à jour des MP) ---
export type SupplierInvoiceStatus = 'NOUVEAU' | 'TRAITEE'
export type InvoiceApplyAction = 'UPDATE' | 'CREATE' | 'SKIP'

export interface InvoiceSummary {
  id: number
  supplierName: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  totalHt: number | null
  totalTtc: number | null
  status: SupplierInvoiceStatus
  lineCount: number
  appliedCount: number
  hasScan: boolean
  createdAt: string
}

export interface InvoiceLine {
  id: number
  position: number
  designation: string
  quantity: number | null
  unit: string | null
  unitPriceHt: number | null
  lineTotalHt: number | null
  vatRate: number | null
  applied: boolean
  rawMaterialId: number | null
  appliedPricePerUnit: number | null
  suggestedRawMaterialId: number | null
  suggestedRawMaterialName: string | null
  suggestedReferenceUnit: MeasureUnit | null
  suggestedPricePerUnit: number | null
  suggestedFamilleId: number | null
  suggestedFamilleName: string | null
  suggestedSousFamilleId: number | null
  suggestedSousFamilleName: string | null
}

export interface InvoiceDetail {
  id: number
  etablissementId: number | null
  supplierName: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  totalHt: number | null
  totalVat: number | null
  totalTtc: number | null
  hasScan: boolean
  status: SupplierInvoiceStatus
  createdAt: string
  appliedAt: string | null
  lines: InvoiceLine[]
}

export interface InvoiceApplyLine {
  lineId: number
  action: InvoiceApplyAction
  rawMaterialId?: number | null
  pricePerUnit?: number | null
  newName?: string | null
  newReferenceUnit?: MeasureUnit | null
  familleId?: number | null
  sousFamilleId?: number | null
}

// --- Saisie quotidienne (CA, perte, mot du jour) ---
export interface MyEtablissement {
  id: number
  name: string
  latitude: number | null
  longitude: number | null
  description: string | null
  address: string | null
  permissions: string[]
}

export interface DailyLossLine {
  articleId: number
  articleCode: string | null
  articleName: string
  quantity: number
}

export interface DailyEntry {
  etablissementId: number
  date: string
  revenue: number | null
  clientCount: number | null
  losses: DailyLossLine[]
  noteProd: string | null
  noteSale: string | null
  updatedAt: string | null
}
