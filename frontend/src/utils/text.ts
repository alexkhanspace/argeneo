/** Normalise un texte pour la recherche : minuscules, sans accents ni espaces superflus. */
export function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Vrai si tous les mots de `query` apparaissent dans l'un des champs (ordre libre). */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return true
  const haystack = fields.map(normalize).join(' ')
  return words.every((w) => haystack.includes(w))
}

/**
 * Éléments existants dont le nom ressemble à `name` (l'un contient l'autre, sans accents) :
 * sert à prévenir les doublons à la création.
 */
export function findSimilar<T extends { name: string }>(name: string, items: T[], limit = 5): T[] {
  const n = normalize(name)
  if (n.length < 3) return []
  return items
    .filter((it) => {
      const other = normalize(it.name)
      return other.includes(n) || n.includes(other)
    })
    .slice(0, limit)
}
