import { api } from './client'
import type {
  AppUser,
  Etablissement,
  LoginResponse,
  Me,
  Permission,
  Preset,
  RecipeScope,
  Tenant,
  UserPermissions,
} from './types'

// --- Auth ---
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
  return data
}

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get<Me>('/me')
  return data
}

// --- Super-Admin : tenants ---
export interface CreateTenantInput {
  name: string
  recipeScope: RecipeScope
  patronEmail: string
  patronPassword: string
  patronFullName: string
}

export async function listTenants(): Promise<Tenant[]> {
  const { data } = await api.get<Tenant[]>('/admin/tenants')
  return data
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  const { data } = await api.post<Tenant>('/admin/tenants', input)
  return data
}

// --- Patron : etablissements (lecture seule ; création réservée au Super-Admin) ---
export async function listEtablissements(): Promise<Etablissement[]> {
  const { data } = await api.get<Etablissement[]>('/etablissements')
  return data
}

// --- Super-Admin : etablissements d'un tenant (souscription / licence) ---
export async function listTenantEtablissements(tenantId: number): Promise<Etablissement[]> {
  const { data } = await api.get<Etablissement[]>(`/admin/tenants/${tenantId}/etablissements`)
  return data
}

export async function createTenantEtablissement(
  tenantId: number,
  input: { name: string; address?: string },
): Promise<Etablissement> {
  const { data } = await api.post<Etablissement>(`/admin/tenants/${tenantId}/etablissements`, input)
  return data
}

// --- Patron : employés ---
export async function listEmployees(): Promise<AppUser[]> {
  const { data } = await api.get<AppUser[]>('/users')
  return data
}

export async function createEmployee(input: {
  email: string
  password: string
  fullName: string
}): Promise<AppUser> {
  const { data } = await api.post<AppUser>('/users', input)
  return data
}

export async function getUserPermissions(userId: number): Promise<UserPermissions> {
  const { data } = await api.get<UserPermissions>(`/users/${userId}/permissions`)
  return data
}

export async function assignPermissions(
  userId: number,
  etablissementId: number,
  permissionCodes: string[],
): Promise<void> {
  await api.put(`/users/${userId}/permissions`, { etablissementId, permissionCodes })
}

// --- Catalogue ---
export async function listPermissions(): Promise<Permission[]> {
  const { data } = await api.get<Permission[]>('/permissions')
  return data
}

export async function listPresets(): Promise<Preset[]> {
  const { data } = await api.get<Preset[]>('/permission-presets')
  return data
}
