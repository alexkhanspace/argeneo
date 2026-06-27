import { getArticle, getCost, getRecipe, photoUrl } from '../api/costing'
import { getProfile, getSettings, logoUrl } from '../api/billing'

async function toDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Construit le blob PDF d'une recette (données enregistrées) — fiche coût et/ou préparation. */
export async function buildRecipePdfBlob(
  articleId: number,
  mode: 'cost' | 'prep' | 'both',
): Promise<Blob> {
  const [{ pdf }, { RecipePdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./RecipePdf'),
  ])
  const [article, recipe, pnet, profile, settings] = await Promise.all([
    getArticle(articleId),
    getRecipe(articleId).catch(() => null),
    getCost(articleId).catch(() => null),
    getProfile().catch(() => null),
    getSettings().catch(() => null),
  ])
  const [photoData, logoData] = await Promise.all([
    toDataUrl(photoUrl(article.photoFile)),
    toDataUrl(profile?.logoFile ? logoUrl(profile.logoFile) : null),
  ])
  const data = {
    name: article.name,
    code: article.code,
    gtin: article.gtin,
    salePriceTtc: article.salePriceTtc,
    pnet,
    steps: recipe?.steps ?? [],
    method: recipe?.method ?? '',
    yieldQuantity: recipe ? String(recipe.yieldQuantity) : '1',
    yieldUnit: recipe?.yieldUnit ?? article.unit,
    lossPercent: recipe ? String((recipe.lossRate ?? 0) * 100) : '0',
    durationMinutes: recipe?.durationMinutes != null ? String(recipe.durationMinutes) : '',
    photoUrl: photoData,
    logoUrl: logoData,
    color: settings?.brandColor1 || '#b5651d',
  }
  return pdf(<RecipePdf data={data} mode={mode} />).toBlob()
}
