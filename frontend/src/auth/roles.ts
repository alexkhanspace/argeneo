import type { Me } from '../api/types'

export const isAdmin = (me: Me) => me.type === 'ADMIN'
export const isPatron = (me: Me) => me.type === 'USER' && me.role === 'PATRON'
export const isEmploye = (me: Me) => me.type === 'USER' && me.role === 'EMPLOYE'

/** Route d'accueil par défaut selon le rôle. */
export function homePathFor(me: Me): string {
  if (isAdmin(me)) return '/admin/tenants'
  if (isPatron(me)) return '/dashboard'
  if (isEmploye(me)) return '/saisie'
  return '/mon-compte'
}
