import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { createArticle, getCost, listArticles, listUnits } from '../../api/costing'
import type { Article, ArticleType, MeasureUnit, UnitInfo } from '../../api/types'

function formatEur(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })
}

export function ArticlesPage() {
  const [items, setItems] = useState<Article[]>([])
  const [costs, setCosts] = useState<Record<number, number | 'error'>>({})
  const [units, setUnits] = useState<UnitInfo[]>([])

  const [name, setName] = useState('')
  const [type, setType] = useState<ArticleType>('FABRIQUE')
  const [unit, setUnit] = useState<MeasureUnit>('PIECE')
  const [salePrice, setSalePrice] = useState('')
  const [vatRate, setVatRate] = useState('0.055')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listArticles()
      .then((list) => {
        setItems(list)
        // PNET live par article (calculé à la volée côté serveur).
        list.forEach((a) => {
          getCost(a.id)
            .then((p) => setCosts((c) => ({ ...c, [a.id]: p.unitCost })))
            .catch(() => setCosts((c) => ({ ...c, [a.id]: 'error' })))
        })
      })
      .catch((e) => setError(errorMessage(e)))
  }
  useEffect(() => {
    refresh()
    listUnits().then(setUnits).catch(() => undefined)
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createArticle({
        name,
        type,
        unit,
        salePrice: salePrice ? Number(salePrice) : null,
        vatRate: vatRate ? Number(vatRate) : null,
        purchasePrice: type === 'ACHAT_REVENTE' && purchasePrice ? Number(purchasePrice) : null,
      })
      setName('')
      setSalePrice('')
      setPurchasePrice('')
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Articles</h1>
      <p className="muted">
        Le coût de revient (PNET) est recalculé en direct : changez un prix matière, il suit.
      </p>

      <div className="grid">
        <section className="card">
          <h2>Ajouter un article</h2>
          <form onSubmit={onSubmit}>
            <label>
              Nom
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Type
              <select value={type} onChange={(e) => setType(e.target.value as ArticleType)}>
                <option value="FABRIQUE">Fabriqué (recette)</option>
                <option value="ACHAT_REVENTE">Acheté-revendu</option>
              </select>
            </label>
            <label>
              Unité
              <select value={unit} onChange={(e) => setUnit(e.target.value as MeasureUnit)}>
                {units.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prix de vente (€, optionnel)
              <input type="number" step="0.01" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </label>
            <label>
              TVA (ex. 0.055 / 0.20)
              <input type="number" step="0.001" min="0" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
            </label>
            {type === 'ACHAT_REVENTE' && (
              <label>
                Prix d'achat (€ = PNET)
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                />
              </label>
            )}
            {error && <div className="alert">{error}</div>}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Mes articles ({items.length})</h2>
          {items.length === 0 ? (
            <p className="muted">Aucun article pour le moment.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Type</th>
                    <th>Vente</th>
                    <th>PNET</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => {
                    const cost = costs[a.id]
                    return (
                      <tr key={a.id}>
                        <td data-label="Article">{a.name}</td>
                        <td data-label="Type">
                          <span className="badge">{a.type === 'FABRIQUE' ? 'Fabriqué' : 'Acheté'}</span>
                        </td>
                        <td data-label="Vente">{formatEur(a.salePrice)}</td>
                        <td data-label="PNET">
                          {cost === undefined ? '…' : cost === 'error' ? '⚠︎' : formatEur(cost)}
                          <span className="muted small"> /{a.unit}</span>
                        </td>
                        <td data-label="" className="actions">
                          {a.type === 'FABRIQUE' && (
                            <Link className="btn-link" to={`/articles/${a.id}/recipe`}>
                              Recette
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
