import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { createEmployee, deleteEmployee, listEmployees } from '../../api/iam'
import type { AppUser } from '../../api/types'
import { Modal } from '../../components/Modal'

export function EmployeesPage() {
  const [items, setItems] = useState<AppUser[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listEmployees().then(setItems).catch((e) => setListError(errorMessage(e)))
  }
  useEffect(refresh, [])

  const onDelete = async (u: AppUser) => {
    if (!window.confirm(`Supprimer l'employé « ${u.fullName} » ?`)) return
    try {
      await deleteEmployee(u.id)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  const filtered = items.filter((u) =>
    `${u.fullName} ${u.email}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createEmployee({ fullName, email, password })
      setFullName('')
      setEmail('')
      setPassword('')
      setOpen(false)
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Équipe</h1>
          <p className="muted">Créez vos employés, puis attribuez leurs permissions par établissement.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Nouvel employé
        </button>
      </div>

      {listError && <div className="alert">{listError}</div>}

      <section className="card">
        <input
          className="search"
          type="search"
          placeholder="Rechercher un employé…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {items.length === 0 ? (
          <p className="muted">Aucun employé. Cliquez sur « + Nouvel employé ».</p>
        ) : filtered.length === 0 ? (
          <p className="muted">Aucun résultat pour « {search} ».</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>E-mail</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Nom">{u.fullName}</td>
                    <td data-label="E-mail">{u.email}</td>
                    <td data-label="" className="actions">
                      <Link className="btn-link" to={`/employees/${u.id}/permissions`}>
                        Permissions
                      </Link>
                      <button className="btn-link danger" onClick={() => onDelete(u)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvel employé">
        <form onSubmit={onSubmit}>
          <label>
            Nom complet
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
          </label>
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Mot de passe (8+ car.)
            <input
              type="password"
              value={password}
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="alert">{error}</div>}
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Création…' : 'Créer l\'employé'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
