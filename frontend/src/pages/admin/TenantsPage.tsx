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
import { Modal } from '../../components/Modal'

export function TenantsPage() {
  const { enterTenant } = useAuth()
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [recipeScope, setRecipeScope] = useState<RecipeScope>('ENSEIGNE')
  const [patronFullName, setPatronFullName] = useState('')
  const [patronEmail, setPatronEmail] = useState('')
  const [patronPassword, setPatronPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Modale de gestion des établissements d'un tenant.
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
    setFormError(null)
    setBusy(true)
    try {
      await createTenant({ name, recipeScope, patronEmail, patronPassword, patronFullName })
      setName('')
      setPatronFullName('')
      setPatronEmail('')
      setPatronPassword('')
      setCreateOpen(false)
      refresh()
    } catch (err) {
      setFormError(errorMessage(err))
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

  const openEtabs = (t: Tenant) => {
    setSelected(t)
    setEtabError(null)
    setEtabName('')
    setEtabAddress('')
    setEtabs([])
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
      setEtabs(await listTenantEtablissements(selected.id))
    } catch (err) {
      setEtabError(errorMessage(err))
    } finally {
      setEtabBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Tenants</h1>
          <p className="muted">Chaque tenant (enseigne) est créé avec son patron initial.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <i className="fa-solid fa-plus" /> Nouveau tenant
        </button>
      </div>

      {error && <div className="alert">{error}</div>}

      <section className="card">
        {tenants.length === 0 ? (
          <p className="muted">Aucun tenant. Cliquez sur « Nouveau tenant ».</p>
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
                        <i className="fa-solid fa-right-to-bracket" /> Accéder
                      </button>
                      <button className="btn-link" onClick={() => openEtabs(t)}>
                        <i className="fa-solid fa-store" /> Établissements
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Création de tenant */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau tenant">
        <form onSubmit={onSubmit}>
          <label>
            Nom de l'enseigne
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
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
          {formError && <div className="alert">{formError}</div>}
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Création…' : 'Créer le tenant'}
          </button>
        </form>
      </Modal>

      {/* Gestion des établissements */}
      <Modal
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? `Établissements — ${selected.name}` : ''}
      >
        <form onSubmit={addEtablissement} className="form-inline">
          <label style={{ flex: 2 }}>
            Nom de l'établissement
            <input value={etabName} onChange={(e) => setEtabName(e.target.value)} required />
          </label>
          <label style={{ flex: 2 }}>
            Adresse (optionnel)
            <input value={etabAddress} onChange={(e) => setEtabAddress(e.target.value)} />
          </label>
          <button className="btn-primary" type="submit" disabled={etabBusy} style={{ alignSelf: 'end' }}>
            <i className="fa-solid fa-plus" /> {etabBusy ? '…' : 'Ajouter'}
          </button>
        </form>
        {etabError && <div className="alert">{etabError}</div>}
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
      </Modal>
    </div>
  )
}
