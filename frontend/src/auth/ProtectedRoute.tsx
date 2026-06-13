import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Me } from '../api/types'
import { useAuth } from './AuthContext'
import { homePathFor } from './roles'

interface Props {
  children: ReactNode
  /** Prédicat d'autorisation ; si absent, toute session authentifiée passe. */
  allow?: (me: Me) => boolean
}

export function ProtectedRoute({ children, allow }: Props) {
  const { me, loading } = useAuth()

  if (loading) {
    return <div className="center muted">Chargement…</div>
  }
  if (!me) {
    return <Navigate to="/login" replace />
  }
  if (allow && !allow(me)) {
    // Authentifié mais pas le bon rôle : on renvoie vers son accueil.
    return <Navigate to={homePathFor(me)} replace />
  }
  return <>{children}</>
}
