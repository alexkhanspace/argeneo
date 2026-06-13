import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import {
  createRawMaterial,
  deleteRawMaterial,
  listRawMaterials,
  listUnits,
  updateRawMaterial,
} from '../../api/costing'
import type { MeasureUnit, RawMaterial, UnitInfo } from '../../api/types'
import { Modal } from '../../components/Modal'

function MaterialRow({
  material,
  onSaved,
  onDelete,
}: {
  material: RawMaterial
  onSaved: () => void
  onDelete: (m: RawMaterial) => void
}) {
  const [price, setPrice] = useState(String(material.pricePerUnit))
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await updateRawMaterial(material.id, { name: material.name, pricePerUnit: Number(price) })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  const changed = Number(price) !== Number(material.pricePerUnit)

  return (
    <tr>
      <td data-label="Matière">{material.name}</td>
      <td data-label="Unité">{material.referenceUnit}</td>
      <td data-label="Prix net" className="price-cell">
        <input
          type="number"
          step="0.0001"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          aria-label={`Prix de ${material.name}`}
        />
        <span className="unit-suffix">€ / {material.referenceUnit}</span>
        <button className="btn-ghost small" onClick={save} disabled={busy || !changed}>
          {busy ? '…' : 'OK'}
        </button>
      </td>
      <td data-label="" className="actions">
        <button className="btn-link danger" onClick={() => onDelete(material)}>
          <i className="fa-solid fa-trash" /> Supprimer
        </button>
      </td>
    </tr>
  )
}

export function MaterialsPage() {
  const [items, setItems] = useState<RawMaterial[]>([])
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [referenceUnit, setReferenceUnit] = useState<MeasureUnit>('KG')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listRawMaterials().then(setItems).catch((e) => setListError(errorMessage(e)))
  }
  useEffect(() => {
    refresh()
    listUnits().then(setUnits).catch(() => undefined)
  }, [])

  const onDelete = async (m: RawMaterial) => {
    if (!window.confirm(`Supprimer la matière « ${m.name} » ?`)) return
    try {
      await deleteRawMaterial(m.id)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  const filtered = items.filter((m) =>
    m.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createRawMaterial({ name, referenceUnit, pricePerUnit: Number(pricePerUnit) })
      setName('')
      setPricePerUnit('')
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
          <h1>Matières premières</h1>
          <p className="muted">
            Le prix saisi est le <strong>dernier prix d'achat</strong> (HT) par unité de référence ;
            le modifier recalcule aussitôt le coût des produits.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <i className="fa-solid fa-plus" /> Nouvelle matière
        </button>
      </div>

      {listError && <div className="alert">{listError}</div>}

      <section className="card">
        <input
          className="search"
          type="search"
          placeholder="Rechercher une matière…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {items.length === 0 ? (
          <p className="muted">Aucune matière. Cliquez sur « + Nouvelle matière ».</p>
        ) : filtered.length === 0 ? (
          <p className="muted">Aucun résultat pour « {search} ».</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Matière</th>
                  <th>Unité</th>
                  <th>Prix net (dernier achat)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <MaterialRow key={m.id} material={m} onSaved={refresh} onDelete={onDelete} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle matière première">
        <form onSubmit={onSubmit}>
          <label>
            Nom
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </label>
          <label>
            Unité de référence
            <select value={referenceUnit} onChange={(e) => setReferenceUnit(e.target.value as MeasureUnit)}>
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.code}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prix net HT (€ / {referenceUnit})
            <input
              type="number"
              step="0.0001"
              min="0"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              required
            />
          </label>
          {error && <div className="alert">{error}</div>}
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
