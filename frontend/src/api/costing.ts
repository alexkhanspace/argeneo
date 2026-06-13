import { api } from './client'
import type {
  Article,
  ArticleType,
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

// --- Matières premières ---
export async function listRawMaterials(): Promise<RawMaterial[]> {
  const { data } = await api.get<RawMaterial[]>('/raw-materials')
  return data
}

export async function createRawMaterial(input: {
  name: string
  referenceUnit: MeasureUnit
  pricePerUnit: number
}): Promise<RawMaterial> {
  const { data } = await api.post<RawMaterial>('/raw-materials', input)
  return data
}

export async function updateRawMaterial(
  id: number,
  input: { name: string; pricePerUnit: number; active?: boolean },
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
}): Promise<Article> {
  const { data } = await api.post<Article>('/articles', input)
  return data
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
}

export async function upsertRecipe(articleId: number, input: UpsertRecipeInput): Promise<Recipe> {
  const { data } = await api.put<Recipe>(`/articles/${articleId}/recipe`, input)
  return data
}
