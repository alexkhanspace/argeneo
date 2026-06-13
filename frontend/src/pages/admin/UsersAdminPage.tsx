import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import { listAllUsers, resetUserPassword } from '../../api/iam'
import type { AdminUserRow } from '../../api/types'
import { Modal } from '../../components/Modal'

function roleLabel(r: AdminUserRow['role']): string {
  if (r === 'SUPER_ADMIN') return 'Super-Admin'
  if (r === 'PATRON') return 'Patron'
  return 'Employé'
}

export function UsersAdminPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [search, setSearch] = useState('')
  const [listError, setListError] = useState<string | null>(null)

  const [target, setTarget] = useState<AdminUserRow | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listAllUsers().then(setUsers).catch((e) => setListError(errorMessage(e)))
  }
  useEffect(refresh, [])

  const openReset = (u: AdminUserRow) => {
    setTarget(u)
    setNewPassword('')
    setError(null)
    setDone(false)
  }

  const submitReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!target) return
    setError(null)
    setBusy(true)
    try {
      await resetUserPassword(target.kind, target.id, newPassword)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const filtered = users.filter((u) =>
    `${u.email} ${u.fullName} ${u.tenantName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="page">
      <h1>Utilisateurs</h1>
      <p className="muted">Tous les comptes de la plateforme. Réinitialisez un mot de passe au besoin.</p>

      {listError && <div className="alert">{listError}</div>}

      <section className="card">
        <input
          className="search"
          type="search"
          placeholder="Rechercher (e-mail, nom, enseigne)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Nom</th>
                <th>Rôle</th>
                <th>Enseigne</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={`${u.kind}-${u.id}`}>
                  <td data-label="E-mail">{u.email}</td>
                  <td data-label="Nom">{u.fullName}</td>
                  <td data-label="Rôle">
                    <span className="badge">{roleLabel(u.role)}</span>
                  </td>
                  <td data-label="Enseigne">{u.tenantName ?? '—'}</td>
                  <td data-label="" className="actions">
                    <button className="btn-link" onClick={() => openReset(u)}>
                      Réinitialiser MDP
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={target != null}
        onClose={() => setTarget(null)}
        title={target ? `Réinitialiser le mot de passe — ${target.email}` : ''}
      >
        {done ? (
          <>
            <div className="success">Mot de passe réinitialisé.</div>
            <button className="btn-primary" onClick={() => setTarget(null)}>
              Fermer
            </button>
          </>
        ) : (
          <form onSubmit={submitReset}>
            <label>
              Nouveau mot de passe (8+ caractères)
              <input
                type="text"
                value={newPassword}
                minLength={8}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
              />
            </label>
            <p className="small muted">
              Communiquez-le à l'utilisateur ; il pourra le changer après connexion.
            </p>
            {error && <div className="alert">{error}</div>}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Réinitialisation…' : 'Réinitialiser'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}
