import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import { createRawMaterial, listRawMaterials, listUnits, updateRawMaterial } from '../../api/costing'
import type { MeasureUnit, RawMaterial, UnitInfo } from '../../api/types'

function MaterialRow({ material, onSaved }: { material: RawMaterial; onSaved: () => void }) {
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
    </tr>
  )
}

export function MaterialsPage() {
  const [items, setItems] = useState<RawMaterial[]>([])
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [name, setName] = useState('')
  const [referenceUnit, setReferenceUnit] = useState<MeasureUnit>('KG')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    listRawMaterials().then(setItems).catch((e) => setError(errorMessage(e)))
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
      await createRawMaterial({ name, referenceUnit, pricePerUnit: Number(pricePerUnit) })
      setName('')
      setPricePerUnit('')
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Matières premières</h1>
      <p className="muted">
        Le prix saisi est le <strong>dernier prix d'achat</strong> par unité de référence. Le
        modifier recalcule aussitôt le coût des produits qui l'utilisent.
      </p>

      <div className="grid">
        <section className="card">
          <h2>Ajouter une matière</h2>
          <form onSubmit={onSubmit}>
            <label>
              Nom
              <input value={name} onChange={(e) => setName(e.target.value)} required />
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
              Prix net (€ / {referenceUnit})
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
        </section>

        <section className="card">
          <h2>Mes matières ({items.length})</h2>
          {items.length === 0 ? (
            <p className="muted">Aucune matière pour le moment.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Matière</th>
                    <th>Unité</th>
                    <th>Prix net (dernier achat)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <MaterialRow key={m.id} material={m} onSaved={refresh} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
