import { Alert } from '@mui/material'
import { findSimilar } from '../utils/text'

/** Avertit, pendant la saisie du nom, qu'un élément au nom proche existe déjà (anti-doublon). */
export function SimilarHint<T extends { name: string; code?: string }>({
  name,
  items,
  what,
}: {
  name: string
  items: T[]
  what: string
}) {
  const similar = findSimilar(name, items)
  if (similar.length === 0) return null
  return (
    <Alert severity="warning">
      {what} au nom proche déjà existant :{' '}
      {similar.map((it) => (it.code ? `${it.name} (${it.code})` : it.name)).join(', ')}
    </Alert>
  )
}
