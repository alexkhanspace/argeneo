import type { Me } from '../api/types'

export const isAdmin = (me: Me) => me.type === 'ADMIN'
export const isPatron = (me: Me) => me.type === 'USER' && me.role === 'PATRON'
export const isEmploye = (me: Me) => me.type === 'USER' && me.role === 'EMPLOYE'

/** Peut passer des commandes fournisseurs (patron, ou employé ayant « passer_commande » quelque part). */
export const canOrder = (me: Me) =>
  isPatron(me) || (isEmploye(me) && me.authorities.some((a) => a.startsWith('passer_commande:')))

/** Route d'accueil par défaut selon le rôle. */
export function homePathFor(me: Me): string {
  if (isAdmin(me)) return '/admin/tenants'
  if (isPatron(me)) return '/dashboard'
  if (isEmploye(me)) return '/saisie'
  return '/mon-compte'
}
