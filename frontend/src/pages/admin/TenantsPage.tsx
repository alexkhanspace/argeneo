import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import {
  createTenant,
  createTenantEtablissement,
  listTenantEtablissements,
  listTenants,
} from '../../api/iam'
import type { Etablissement, RecipeScope, Tenant } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { homePathFor } from '../../auth/roles'

export function TenantsPage() {
  const { enterTenant } = useAuth()
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [recipeScope, setRecipeScope] = useState<RecipeScope>('ENSEIGNE')
  const [patronFullName, setPatronFullName] = useState('')
  const [patronEmail, setPatronEmail] = useState('')
  const [patronPassword, setPatronPassword] = useState('')

  // Gestion des établissements d'un tenant sélectionné.
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [etabs, setEtabs] = useState<Etablissement[]>([])
  const [etabName, setEtabName] = useState('')
  const [etabAddress, setEtabAddress] = useState('')
  const [etabError, setEtabError] = useState<string | null>(null)
  const [etabBusy, setEtabBusy] = useState(false)

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

  const onEnter = async (t: Tenant) => {
    try {
      const me = await enterTenant(t.id)
      navigate(homePathFor(me))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const selectTenant = (t: Tenant) => {
    setSelected(t)
    setEtabError(null)
    setEtabName('')
    setEtabAddress('')
    listTenantEtablissements(t.id).then(setEtabs).catch((e) => setEtabError(errorMessage(e)))
  }

  const addEtablissement = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setEtabError(null)
    setEtabBusy(true)
    try {
      await createTenantEtablissement(selected.id, { name: etabName, address: etabAddress || undefined })
      setEtabName('')
      setEtabAddress('')
      const list = await listTenantEtablissements(selected.id)
      setEtabs(list)
    } catch (err) {
      setEtabError(errorMessage(err))
    } finally {
      setEtabBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Tenants</h1>
      <p className="muted">
        Chaque tenant (artisan/enseigne) est créé avec son patron initial. Les
        établissements sont ajoutés ici, à la souscription (licence).
      </p>

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
                <option value="ETABLISSEMENT">Propres à chaque établissement</option>
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
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Enseigne</th>
                    <th>Recettes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id}>
                      <td data-label="#">{t.id}</td>
                      <td data-label="Enseigne">{t.name}</td>
                      <td data-label="Recettes">
                        {t.recipeScope === 'ENSEIGNE' ? 'Enseigne' : 'Par établissement'}
                      </td>
                      <td data-label="" className="actions">
                        <button className="btn-link" onClick={() => onEnter(t)}>
                          Accéder
                        </button>
                        <button className="btn-link" onClick={() => selectTenant(t)}>
                          Établissements
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selected && (
        <section className="card">
          <h2>Établissements — {selected.name}</h2>
          <div className="grid">
            <form onSubmit={addEtablissement}>
              <label>
                Nom de l'établissement
                <input value={etabName} onChange={(e) => setEtabName(e.target.value)} required />
              </label>
              <label>
                Adresse (optionnel)
                <input value={etabAddress} onChange={(e) => setEtabAddress(e.target.value)} />
              </label>
              {etabError && <div className="alert">{etabError}</div>}
              <button className="btn-primary" type="submit" disabled={etabBusy}>
                {etabBusy ? 'Ajout…' : 'Ajouter l\'établissement'}
              </button>
            </form>

            <div>
              {etabs.length === 0 ? (
                <p className="muted">Aucun établissement pour ce tenant.</p>
              ) : (
                <ul className="plain-list">
                  {etabs.map((b) => (
                    <li key={b.id}>
                      <strong>{b.name}</strong>
                      {b.address ? <span className="muted"> — {b.address}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
