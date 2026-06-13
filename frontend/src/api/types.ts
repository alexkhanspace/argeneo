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

// --- Costing (matières, articles, recettes, PNET) ---
export type MeasureUnit = 'G' | 'KG' | 'ML' | 'L' | 'PIECE'
export type MeasureDimension = 'MASS' | 'VOLUME' | 'PIECE'
export type ArticleType = 'ACHAT_REVENTE' | 'FABRIQUE'
export type ComponentType = 'RAW' | 'SUBRECIPE'

export interface UnitInfo {
  code: MeasureUnit
  dimension: MeasureDimension
}

export interface RawMaterial {
  id: number
  name: string
  referenceUnit: MeasureUnit
  pricePerUnit: number
  active: boolean
}

export interface Article {
  id: number
  code?: string
  name: string
  type: ArticleType
  unit: MeasureUnit
  salePrice: number | null
  vatRate: number | null
  purchasePrice: number | null
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

// --- Saisie quotidienne (CA, perte, mot du jour) ---
export interface MyEtablissement {
  id: number
  name: string
  permissions: string[]
}

export interface DailyEntry {
  etablissementId: number
  date: string
  revenue: number | null
  loss: number | null
  noteOfDay: string | null
  updatedAt: string | null
}
