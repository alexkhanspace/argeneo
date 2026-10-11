import type { MeasureUnit } from '../api/types'

/** Ingrédient d'une recette tel qu'utilisé par la fiche proportionnelle. */
export interface PropIngredient {
  label: string
  quantity: number
  unit: MeasureUnit
}

/** Colonne calculée : un ingrédient, son unité d'affichage et sa part dans le poids total. */
export interface PropColumn {
  label: string
  /** Unité affichée dans l'en-tête (g, kg, l, pièce…). */
  unit: string
  /** Part de l'ingrédient dans le poids de la recette (null pour les pièces). */
  percent: number | null
  /** Quantité, dans l'unité affichée, pour 1 kg de fabrication. */
  perKg: number
  decimals: number
}

export interface PropTable {
  /** Poids total de la recette de base (kg), somme des ingrédients en masse/volume. */
  baseKg: number
  columns: PropColumn[]
  /** Poids de fabrication (kg) en lignes. */
  weights: number[]
  /** Quantités : values[ligne][colonne]. */
  values: number[][]
}

export const MAX_ROWS = 200

/** Quantité convertie en kg (volume ≈ masse, densité 1) ; null pour les pièces. */
function toKg(quantity: number, unit: MeasureUnit): number | null {
  switch (unit) {
    case 'G':
    case 'ML':
      return quantity / 1000
    case 'KG':
    case 'L':
      return quantity
    default:
      return null
  }
}

/** Liste des poids de fabrication de `min` à `max` par pas de `step` (bornes incluses). */
export function weightRange(min: number, max: number, step: number): number[] {
  if (!(min > 0) || !(max >= min) || !(step > 0)) return []
  const out: number[] = []
  // Arrondi pour éviter les dérives flottantes (0,1 + 0,2…).
  for (let i = 0; out.length < MAX_ROWS; i++) {
    const w = Math.round((min + i * step) * 1000) / 1000
    if (w > max + 1e-9) break
    out.push(w)
  }
  return out
}

/**
 * Tableau proportionnel : pour chaque poids de fabrication, la quantité de chaque ingrédient,
 * au prorata du poids total de la recette de base.
 */
export function buildPropTable(ingredients: PropIngredient[], weights: number[]): PropTable | null {
  const valid = ingredients.filter((i) => i.quantity > 0)
  const baseKg = valid.reduce((sum, i) => sum + (toKg(i.quantity, i.unit) ?? 0), 0)
  if (baseKg <= 0) return null
  const maxW = weights.length ? Math.max(...weights) : 1

  const columns: PropColumn[] = valid.map((i) => {
    const kg = toKg(i.quantity, i.unit)
    if (kg == null) {
      return { label: i.label, unit: 'pièce', percent: null, perKg: i.quantity / baseKg, decimals: 1 }
    }
    const isVolume = i.unit === 'ML' || i.unit === 'L'
    // Petites quantités (sel, levure…) en g/ml, sinon en kg/l.
    const small = (kg / baseKg) * maxW < 1
    return {
      label: i.label,
      unit: small ? (isVolume ? 'ml' : 'g') : isVolume ? 'l' : 'kg',
      percent: (kg / baseKg) * 100,
      perKg: small ? (kg / baseKg) * 1000 : kg / baseKg,
      decimals: small ? 1 : 3,
    }
  })

  const values = weights.map((w) => columns.map((c) => c.perKg * w))
  return { baseKg, columns, weights, values }
}

export function formatQty(v: number, decimals: number): string {
  return v.toLocaleString('fr-FR', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })
}
