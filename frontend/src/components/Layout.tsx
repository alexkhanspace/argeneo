import { useState } from 'react'
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
  const [menuOpen, setMenuOpen] = useState(false)

  if (!me) return null

  const onLogout = () => {
    logout()
    navigate('/login')
  }
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="app">
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
              <NavLink to="/etablissements">Etablissements</NavLink>
              <NavLink to="/employees">Équipe</NavLink>
              <NavLink to="/articles">Articles</NavLink>
              <NavLink to="/materials">Matières</NavLink>
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
