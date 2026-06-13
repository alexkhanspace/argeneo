import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import { createTenant, listTenants } from '../../api/iam'
import type { RecipeScope, Tenant } from '../../api/types'

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [recipeScope, setRecipeScope] = useState<RecipeScope>('ENSEIGNE')
  const [patronFullName, setPatronFullName] = useState('')
  const [patronEmail, setPatronEmail] = useState('')
  const [patronPassword, setPatronPassword] = useState('')

  const refresh = () => {
    listTenants().then(setTenants).catch((e) => setError(errorMessage(e)))
  }
  useEffect(refresh, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createTenant({ name, recipeScope, patronEmail, patronPassword, patronFullName })
      setName('')
      setPatronFullName('')
      setPatronEmail('')
      setPatronPassword('')
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Tenants</h1>
      <p className="muted">Chaque tenant (artisan/enseigne) est créé avec son patron initial.</p>

      <div className="grid">
        <section className="card">
          <h2>Créer un tenant</h2>
          <form onSubmit={onSubmit}>
            <label>
              Nom de l'enseigne
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Portée des recettes
              <select value={recipeScope} onChange={(e) => setRecipeScope(e.target.value as RecipeScope)}>
                <option value="ENSEIGNE">Communes à l'enseigne</option>
                <option value="BOULANGERIE">Propres à chaque boulangerie</option>
              </select>
            </label>
            <hr />
            <p className="muted small">Patron du tenant</p>
            <label>
              Nom complet
              <input value={patronFullName} onChange={(e) => setPatronFullName(e.target.value)} required />
            </label>
            <label>
              E-mail
              <input type="email" value={patronEmail} onChange={(e) => setPatronEmail(e.target.value)} required />
            </label>
            <label>
              Mot de passe (8+ car.)
              <input
                type="password"
                value={patronPassword}
                minLength={8}
                onChange={(e) => setPatronPassword(e.target.value)}
                required
              />
            </label>
            {error && <div className="alert">{error}</div>}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Création…' : 'Créer le tenant'}
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Tenants existants ({tenants.length})</h2>
          {tenants.length === 0 ? (
            <p className="muted">Aucun tenant pour le moment.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Enseigne</th>
                  <th>Recettes</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td data-label="#">{t.id}</td>
                    <td data-label="Enseigne">{t.name}</td>
                    <td data-label="Recettes">{t.recipeScope === 'ENSEIGNE' ? 'Enseigne' : 'Par boulangerie'}</td>
                    <td data-label="Statut">{t.active ? 'Actif' : 'Inactif'}</td>
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
