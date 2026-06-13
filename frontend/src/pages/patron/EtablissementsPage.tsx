import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import { createEtablissement, listEtablissements } from '../../api/iam'
import type { Etablissement } from '../../api/types'

export function EtablissementsPage() {
  const [items, setItems] = useState<Etablissement[]>([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listEtablissements().then(setItems).catch((e) => setError(errorMessage(e)))
  }
  useEffect(refresh, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createEtablissement({ name, address: address || undefined })
      setName('')
      setAddress('')
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Etablissements</h1>
      <p className="muted">Les points de vente de votre enseigne.</p>

      <div className="grid">
        <section className="card">
          <h2>Ajouter une etablissement</h2>
          <form onSubmit={onSubmit}>
            <label>
              Nom
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Adresse (optionnel)
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            {error && <div className="alert">{error}</div>}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Mes etablissements ({items.length})</h2>
          {items.length === 0 ? (
            <p className="muted">Aucune etablissement pour le moment.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nom</th>
                  <th>Adresse</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id}>
                    <td data-label="#">{b.id}</td>
                    <td data-label="Nom">{b.name}</td>
                    <td data-label="Adresse">{b.address ?? '—'}</td>
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
