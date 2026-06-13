export type PrincipalType = 'ADMIN' | 'USER'
export type UserRole = 'PATRON' | 'EMPLOYE'
export type RecipeScope = 'ENSEIGNE' | 'BOULANGERIE'

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

export interface Boulangerie {
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

export interface BoulangeriePermissions {
  boulangerieId: number
  permissionCodes: string[]
}

export interface UserPermissions {
  userId: number
  boulangeries: BoulangeriePermissions[]
}
