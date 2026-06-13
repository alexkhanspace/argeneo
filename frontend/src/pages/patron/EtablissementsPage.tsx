import { useEffect, useState } from 'react'
import { errorMessage } from '../../api/client'
import { listEtablissements } from '../../api/iam'
import type { Etablissement } from '../../api/types'

export function EtablissementsPage() {
  const [items, setItems] = useState<Etablissement[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listEtablissements().then(setItems).catch((e) => setError(errorMessage(e)))
  }, [])

  return (
    <div className="page">
      <h1>Établissements</h1>
      <p className="muted">
        Les points de vente de votre enseigne. L'ajout d'un établissement se fait
        sous licence, à la souscription — contactez l'éditeur.
      </p>

      {error && <div className="alert">{error}</div>}

      <section className="card">
        <h2>Mes établissements ({items.length})</h2>
        {items.length === 0 ? (
          <p className="muted">Aucun établissement pour le moment.</p>
        ) : (
          <div className="table-wrap">
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
          </div>
        )}
      </section>
    </div>
  )
}
