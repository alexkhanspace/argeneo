import { api } from './client'
import type {
  Article,
  ArticleType,
  Famille,
  FamilleScope,
  MeasureUnit,
  Pnet,
  RawMaterial,
  Recipe,
  RecipeComponent,
  UnitInfo,
} from './types'

// --- Unités ---
export async function listUnits(): Promise<UnitInfo[]> {
  const { data } = await api.get<UnitInfo[]>('/units')
  return data
}

// --- Familles / sous-familles (séparées par périmètre ARTICLE / RAW_MATERIAL) ---
export async function listFamilles(scope: FamilleScope): Promise<Famille[]> {
  const { data } = await api.get<Famille[]>('/familles', { params: { scope } })
  return data
}

export async function createFamille(
  scope: FamilleScope,
  input: { name: string; parentId?: number | null },
): Promise<Famille> {
  const { data } = await api.post<Famille>('/familles', input, { params: { scope } })
  return data
}

export async function updateFamille(
  scope: FamilleScope,
  id: number,
  input: { name: string },
): Promise<Famille> {
  const { data } = await api.put<Famille>(`/familles/${id}`, input, { params: { scope } })
  return data
}

export async function deleteFamille(scope: FamilleScope, id: number): Promise<void> {
  await api.delete(`/familles/${id}`, { params: { scope } })
}

// --- Matières premières ---
export async function listRawMaterials(): Promise<RawMaterial[]> {
  const { data } = await api.get<RawMaterial[]>('/raw-materials')
  return data
}

export async function createRawMaterial(input: {
  name: string
  referenceUnit: MeasureUnit
  pricePerUnit: number
  familleId?: number | null
  sousFamilleId?: number | null
}): Promise<RawMaterial> {
  const { data } = await api.post<RawMaterial>('/raw-materials', input)
  return data
}

export async function updateRawMaterial(
  id: number,
  input: {
    name: string
    pricePerUnit: number
    active?: boolean
    referenceUnit?: MeasureUnit
    familleId?: number | null
    sousFamilleId?: number | null
  },
): Promise<RawMaterial> {
  const { data } = await api.put<RawMaterial>(`/raw-materials/${id}`, input)
  return data
}

export async function deleteRawMaterial(id: number): Promise<void> {
  await api.delete(`/raw-materials/${id}`)
}

// --- Articles ---
export async function listArticles(): Promise<Article[]> {
  const { data } = await api.get<Article[]>('/articles')
  return data
}

export async function getArticle(id: number): Promise<Article> {
  const { data } = await api.get<Article>(`/articles/${id}`)
  return data
}

export async function createArticle(input: {
  name: string
  type: ArticleType
  unit: MeasureUnit
  salePriceTtc?: number | null
  vatRate?: number | null
  purchasePrice?: number | null
  description?: string | null
  familleId?: number | null
  sousFamilleId?: number | null
}): Promise<Article> {
  const { data } = await api.post<Article>('/articles', input)
  return data
}

export async function updateArticle(
  id: number,
  input: {
    name: string
    type?: ArticleType
    unit: MeasureUnit
    salePriceTtc?: number | null
    vatRate?: number | null
    purchasePrice?: number | null
    gtin?: string | null
    description?: string | null
    familleId?: number | null
    sousFamilleId?: number | null
  },
): Promise<Article> {
  const { data } = await api.put<Article>(`/articles/${id}`, input)
  return data
}

export async function uploadArticlePhoto(id: number, file: File): Promise<Article> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<Article>(`/articles/${id}/photo`, form)
  return data
}

/** Génère une photo d'article par IA (Imagen). `hint` = précision optionnelle. */
export async function generateArticlePhoto(id: number, hint?: string): Promise<Article> {
  const { data } = await api.post<Article>(`/articles/${id}/photo/generate`, { hint: hint ?? null })
  return data
}

// --- Composition d'un article MENU ---
export interface MenuItemView {
  componentArticleId: number
  componentCode: string | null
  componentName: string
  quantity: number
}

export async function getMenu(menuArticleId: number): Promise<MenuItemView[]> {
  const { data } = await api.get<MenuItemView[]>(`/articles/${menuArticleId}/menu`)
  return data
}

export async function saveMenu(
  menuArticleId: number,
  items: { componentArticleId: number; quantity: number }[],
): Promise<MenuItemView[]> {
  const { data } = await api.put<MenuItemView[]>(`/articles/${menuArticleId}/menu`, { items })
  return data
}

/** URL publique d'une photo d'article servie par le backend (/api/media/{file}). */
export function photoUrl(file: string | null): string | null {
  return file ? `/api/media/${file}` : null
}

export async function deleteArticle(id: number): Promise<void> {
  await api.delete(`/articles/${id}`)
}

export async function getCost(articleId: number): Promise<Pnet> {
  const { data } = await api.get<Pnet>(`/articles/${articleId}/cost`)
  return data
}

// --- Recettes ---
export async function getRecipe(articleId: number): Promise<Recipe> {
  const { data } = await api.get<Recipe>(`/articles/${articleId}/recipe`)
  return data
}

export interface UpsertRecipeInput {
  yieldQuantity: number
  yieldUnit: MeasureUnit
  lossRate: number
  method?: string | null
  durationMinutes?: number | null
  components: Array<Omit<RecipeComponent, 'id' | 'label'>>
  steps: string[]
}

export async function upsertRecipe(articleId: number, input: UpsertRecipeInput): Promise<Recipe> {
  const { data } = await api.put<Recipe>(`/articles/${articleId}/recipe`, input)
  return data
}
