import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import { errorMessage } from '../../api/client'
import {
  getArticle,
  getCost,
  getRecipe,
  listArticles,
  listRawMaterials,
  listUnits,
  upsertRecipe,
} from '../../api/costing'
import type {
  Article,
  ComponentType,
  MeasureUnit,
  Pnet,
  RawMaterial,
  UnitInfo,
} from '../../api/types'

interface CompRow {
  type: ComponentType
  refId: number | ''
  quantity: string
  unit: MeasureUnit
}

function formatEur(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })
}

export function RecipeEditorPage() {
  const { id } = useParams()
  const articleId = Number(id)

  const [article, setArticle] = useState<Article | null>(null)
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [subArticles, setSubArticles] = useState<Article[]>([])

  const [yieldQuantity, setYieldQuantity] = useState('1')
  const [yieldUnit, setYieldUnit] = useState<MeasureUnit>('PIECE')
  const [lossPercent, setLossPercent] = useState('0')
  const [method, setMethod] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [rows, setRows] = useState<CompRow[]>([])

  const [pnet, setPnet] = useState<Pnet | null>(null)
  const [pnetError, setPnetError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadCost = () => {
    getCost(articleId)
      .then((p) => {
        setPnet(p)
        setPnetError(null)
      })
      .catch((e) => {
        setPnet(null)
        setPnetError(errorMessage(e))
      })
  }

  useEffect(() => {
    Promise.all([getArticle(articleId), listUnits(), listRawMaterials(), listArticles()])
      .then(([art, u, mats, arts]) => {
        setArticle(art)
        setUnits(u)
        setMaterials(mats)
        setSubArticles(arts.filter((a) => a.type === 'FABRIQUE' && a.id !== articleId))
        setYieldUnit(art.unit)
      })
      .catch((e) => setError(errorMessage(e)))

    getRecipe(articleId)
      .then((r) => {
        setYieldQuantity(String(r.yieldQuantity))
        setYieldUnit(r.yieldUnit)
        setLossPercent(String(Math.round(r.lossRate * 1000) / 10))
        setMethod(r.method ?? '')
        setDurationMinutes(r.durationMinutes != null ? String(r.durationMinutes) : '')
        setRows(
          r.components.map((c) => ({
            type: c.type,
            refId: c.type === 'RAW' ? (c.rawMaterialId ?? '') : (c.subArticleId ?? ''),
            quantity: String(c.quantity),
            unit: c.unit,
          })),
        )
        loadCost()
      })
      .catch((e) => {
        // 404 = pas encore de recette : on démarre vide, pas une erreur.
        if (!(axios.isAxiosError(e) && e.response?.status === 404)) {
          setError(errorMessage(e))
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId])

  const addRow = () =>
    setRows((r) => [...r, { type: 'RAW', refId: '', quantity: '', unit: 'G' }])
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))
  const updateRow = (i: number, patch: Partial<CompRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await upsertRecipe(articleId, {
        yieldQuantity: Number(yieldQuantity),
        yieldUnit,
        lossRate: Number(lossPercent) / 100,
        method: method || null,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        components: rows.map((row) => ({
          type: row.type,
          rawMaterialId: row.type === 'RAW' ? Number(row.refId) : null,
          subArticleId: row.type === 'SUBRECIPE' ? Number(row.refId) : null,
          quantity: Number(row.quantity),
          unit: row.unit,
        })),
      })
      loadCost()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!article) {
    return (
      <div className="page">
        <p className="muted">{error ?? 'Chargement…'}</p>
        <Link className="btn-link" to="/articles">
          ← Articles
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <Link className="btn-link" to="/articles">
        ← Articles
      </Link>
      <h1>Recette — {article.name}</h1>

      <div className="grid grid-recipe">
        <section className="card">
          <h2>Composition</h2>
          <p className="muted small">
            Saisissez la recette pour un lot, puis indiquez le <strong>rendement</strong> : ce que
            ce lot produit (ex. 120 pièces). Le coût de revient à l'unité = coût du lot ÷ rendement
            (ajusté de la perte).
          </p>
          <form onSubmit={onSubmit}>
            <div className="form-inline">
              <label>
                Rendement (quantité produite)
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={yieldQuantity}
                  onChange={(e) => setYieldQuantity(e.target.value)}
                  required
                />
              </label>
              <label>
                Unité
                <select value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value as MeasureUnit)}>
                  {units.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Perte (%)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="99"
                  value={lossPercent}
                  onChange={(e) => setLossPercent(e.target.value)}
                />
              </label>
            </div>

            <h3>Composants</h3>
            {rows.length === 0 && <p className="muted small">Aucun composant. Ajoutez-en un.</p>}
            {rows.map((row, i) => (
              <div className="comp-row" key={i}>
                <select
                  value={row.type}
                  onChange={(e) =>
                    updateRow(i, { type: e.target.value as ComponentType, refId: '' })
                  }
                >
                  <option value="RAW">Matière</option>
                  <option value="SUBRECIPE">Sous-recette</option>
                </select>
                <select
                  value={row.refId}
                  onChange={(e) => updateRow(i, { refId: Number(e.target.value) })}
                  required
                >
                  <option value="">— choisir —</option>
                  {(row.type === 'RAW' ? materials : subArticles).map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="Qté"
                  value={row.quantity}
                  onChange={(e) => updateRow(i, { quantity: e.target.value })}
                  required
                />
                <select value={row.unit} onChange={(e) => updateRow(i, { unit: e.target.value as MeasureUnit })}>
                  {units.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.code}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-ghost small" onClick={() => removeRow(i)}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn-ghost small" onClick={addRow}>
              + Composant
            </button>

            <label className="mt">
              Méthode (optionnel)
              <textarea value={method} onChange={(e) => setMethod(e.target.value)} rows={3} />
            </label>
            <label>
              Durée (minutes, optionnel)
              <input
                type="number"
                min="0"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </label>

            {error && <div className="alert">{error}</div>}
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer la recette'}
            </button>
          </form>
        </section>

        <section className="card pnet-card">
          <h2>Coût de revient (PNET)</h2>
          {pnetError && <div className="alert">{pnetError}</div>}
          {!pnet && !pnetError && <p className="muted">Enregistrez la recette pour calculer le PNET.</p>}
          {pnet && (
            <>
              <div className="pnet-headline">
                <span className="pnet-value">{formatEur(pnet.unitCost)}</span>
                <span className="muted"> / {pnet.unit}</span>
              </div>
              <p className="muted small">
                Lot : {formatEur(pnet.batchCost)} pour {pnet.effectiveYield} {pnet.yieldUnit} (perte incluse)
              </p>
              <table className="pnet-table">
                <thead>
                  <tr>
                    <th>Composant</th>
                    <th>Qté</th>
                    <th>Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {pnet.lines.map((l, i) => (
                    <tr key={i}>
                      <td data-label="Composant">
                        {l.label} {l.type === 'SUBRECIPE' && <span className="badge">sous-recette</span>}
                      </td>
                      <td data-label="Qté">
                        {l.quantity} {l.unit}
                      </td>
                      <td data-label="Coût">{formatEur(l.lineCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
