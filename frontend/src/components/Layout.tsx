import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { Me } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { isAdmin, isEmploye, isPatron } from '../auth/roles'

function roleLabel(me: Me): string {
  if (isAdmin(me)) return 'Super-Admin'
  if (me.role === 'PATRON') return 'Patron'
  return 'Employé'
}

export function Layout() {
  const { me, logout, exitImpersonation } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!me) return null

  const onLogout = () => {
    logout()
    navigate('/login')
  }
  const onExitImpersonation = async () => {
    await exitImpersonation()
    navigate('/admin/tenants')
  }
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="app">
      {me.impersonatedBy != null && (
        <div className="impersonation-bar">
          <span>
            🛟 Mode support — vous agissez en tant que <strong>{me.fullName}</strong>
          </span>
          <button className="btn-ghost small" onClick={onExitImpersonation}>
            Quitter le tenant
          </button>
        </div>
      )}
      <header className="topbar">
        <div className="topbar-main">
          <button
            className="hamburger"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
          <img src="/argeneo-logo.png" className="brand-logo" alt="Argéneo" />
        </div>

        <nav className={`nav ${menuOpen ? 'open' : ''}`} onClick={closeMenu}>
          {isAdmin(me) && <NavLink to="/admin/tenants">Tenants</NavLink>}
          {isPatron(me) && (
            <>
              <NavLink to="/dashboard">Tableau de bord</NavLink>
              <NavLink to="/etablissements">Établissements</NavLink>
              <NavLink to="/employees">Équipe</NavLink>
              <NavLink to="/articles">Articles</NavLink>
              <NavLink to="/materials">Matières</NavLink>
              <NavLink to="/saisie">Calendrier</NavLink>
            </>
          )}
          {isEmploye(me) && <NavLink to="/saisie">Calendrier</NavLink>}
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
