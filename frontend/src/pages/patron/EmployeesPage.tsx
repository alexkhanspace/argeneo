import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { createEmployee, listEmployees } from '../../api/iam'
import type { AppUser } from '../../api/types'

export function EmployeesPage() {
  const [items, setItems] = useState<AppUser[]>([])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listEmployees().then(setItems).catch((e) => setError(errorMessage(e)))
  }
  useEffect(refresh, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createEmployee({ fullName, email, password })
      setFullName('')
      setEmail('')
      setPassword('')
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Équipe</h1>
      <p className="muted">Créez vos employés, puis attribuez leurs permissions par boulangerie.</p>

      <div className="grid">
        <section className="card">
          <h2>Ajouter un employé</h2>
          <form onSubmit={onSubmit}>
            <label>
              Nom complet
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
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
        </section>

        <section className="card">
          <h2>Mes employés ({items.length})</h2>
          {items.length === 0 ? (
            <p className="muted">Aucun employé pour le moment.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>E-mail</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Nom">{u.fullName}</td>
                    <td data-label="E-mail">{u.email}</td>
                    <td data-label="" className="actions">
                      <Link className="btn-link" to={`/employees/${u.id}/permissions`}>
                        Permissions
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
