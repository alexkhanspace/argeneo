import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { Me } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { isAdmin, isPatron } from '../auth/roles'

function roleLabel(me: Me): string {
  if (isAdmin(me)) return 'Super-Admin'
  if (me.role === 'PATRON') return 'Patron'
  return 'Employé'
}

export function Layout() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()

  if (!me) return null

  const onLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Argeneo</div>
        <nav className="nav">
          {isAdmin(me) && <NavLink to="/admin/tenants">Tenants</NavLink>}
          {isPatron(me) && (
            <>
              <NavLink to="/boulangeries">Boulangeries</NavLink>
              <NavLink to="/employees">Équipe</NavLink>
            </>
          )}
        </nav>
        <div className="user">
          <span className="user-name">{me.fullName}</span>
          <span className="badge">{roleLabel(me)}</span>
          <button className="btn-ghost" onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
