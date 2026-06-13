import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { createArticle, deleteArticle, getCost, listArticles, listUnits } from '../../api/costing'
import type { Article, ArticleType, MeasureUnit, UnitInfo } from '../../api/types'
import { Modal } from '../../components/Modal'

function formatEur(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })
}

type CostInfo = { unitCost: number; coefficient: number | null } | 'error' | undefined

const VAT_OPTIONS = [
  { value: '0.055', label: '5,5 % (à emporter)' },
  { value: '0.10', label: '10 % (sur place)' },
  { value: '0.20', label: '20 % (alcool/divers)' },
]

export function ArticlesPage() {
  const [items, setItems] = useState<Article[]>([])
  const [costs, setCosts] = useState<Record<number, CostInfo>>({})
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [listError, setListError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
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
        list.forEach((a) => {
          getCost(a.id)
            .then((p) => setCosts((c) => ({ ...c, [a.id]: { unitCost: p.unitCost, coefficient: p.coefficient ?? null } })))
            .catch(() => setCosts((c) => ({ ...c, [a.id]: 'error' })))
        })
      })
      .catch((e) => setListError(errorMessage(e)))
  }
  useEffect(() => {
    refresh()
    listUnits().then(setUnits).catch(() => undefined)
  }, [])

  const onDelete = async (a: Article) => {
    if (!window.confirm(`Supprimer l'article « ${a.name} » (${a.code}) ?`)) return
    try {
      await deleteArticle(a.id)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  const filtered = items.filter((a) =>
    `${a.code} ${a.name}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createArticle({
        name,
        type,
        unit,
        salePriceTtc: salePrice ? Number(salePrice) : null,
        vatRate: vatRate ? Number(vatRate) : null,
        purchasePrice: type === 'ACHAT_REVENTE' && purchasePrice ? Number(purchasePrice) : null,
      })
      setName('')
      setSalePrice('')
      setPurchasePrice('')
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
          <h1>Articles</h1>
          <p className="muted">Coût de revient (PNET, HT) et coefficient recalculés en direct.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <i className="fa-solid fa-plus" /> Nouvel article
        </button>
      </div>

      {listError && <div className="alert">{listError}</div>}

      <section className="card">
        <input
          className="search"
          type="search"
          placeholder="Rechercher (code ou nom)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {items.length === 0 ? (
          <p className="muted">Aucun article. Cliquez sur « + Nouvel article ».</p>
        ) : filtered.length === 0 ? (
          <p className="muted">Aucun résultat pour « {search} ».</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Article</th>
                  <th>Type</th>
                  <th>PV TTC</th>
                  <th>PNET HT</th>
                  <th>Coef</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const cost = costs[a.id]
                  return (
                    <tr key={a.id}>
                      <td data-label="Code"><code>{a.code}</code></td>
                      <td data-label="Article">{a.name}</td>
                      <td data-label="Type">
                        <span className="badge">{a.type === 'FABRIQUE' ? 'Fabriqué' : 'Acheté'}</span>
                      </td>
                      <td data-label="PV TTC">{formatEur(a.salePriceTtc)}</td>
                      <td data-label="PNET HT">
                        {cost === undefined ? '…' : cost === 'error' ? '⚠︎' : formatEur(cost.unitCost)}
                      </td>
                      <td data-label="Coef">
                        {cost && cost !== 'error' && cost.coefficient != null
                          ? `×${cost.coefficient.toFixed(2)}`
                          : '—'}
                      </td>
                      <td data-label="" className="actions">
                        {a.type === 'FABRIQUE' && (
                          <Link className="btn-link" to={`/articles/${a.id}/recipe`}>
                            <i className="fa-solid fa-list-check" /> Recette
                          </Link>
                        )}
                        <button className="btn-link danger" onClick={() => onDelete(a)}>
                          <i className="fa-solid fa-trash" /> Supprimer
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvel article">
        <form onSubmit={onSubmit}>
          <label>
            Nom
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <label>
            Type
            <select value={type} onChange={(e) => setType(e.target.value as ArticleType)}>
              <option value="FABRIQUE">Fabriqué (recette) — code R</option>
              <option value="ACHAT_REVENTE">Acheté-revendu — code A</option>
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
            Prix de vente TTC (€)
            <input type="number" step="0.01" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
          </label>
          <label>
            TVA
            <select value={vatRate} onChange={(e) => setVatRate(e.target.value)}>
              {VAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {type === 'ACHAT_REVENTE' && (
            <label>
              Prix d'achat HT (€ = PNET)
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
            {busy ? 'Création…' : 'Créer l\'article'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
