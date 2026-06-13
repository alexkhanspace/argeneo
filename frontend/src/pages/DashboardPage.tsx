import { useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import { getCost, listArticles, listRawMaterials } from '../api/costing'
import { listEmployees, listEtablissements } from '../api/iam'
import { getDay, listMonth, listMyEtablissements } from '../api/daily'
import type { DailyEntry, Pnet } from '../api/types'

function formatEur(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 4,
  })
}

/** ISO YYYY-MM-DD à partir d'une Date locale (sans décalage de fuseau). */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

interface MarginRow {
  id: number
  code: string
  name: string
  pnet: number
  pvTtc: number | null
  marginHt: number | null
  coefficient: number | null
}

export function DashboardPage() {
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState({ etabs: 0, articles: 0, employees: 0, materials: 0 })
  const [caJour, setCaJour] = useState<number | null>(null)
  const [margins, setMargins] = useState<MarginRow[]>([])
  const [recent, setRecent] = useState<DailyEntry[]>([])
  const [recentEtab, setRecentEtab] = useState<string | null>(null)

  useEffect(() => {
    const today = toISODate(new Date())

    // KPI counts (chacun indépendant, tolérant aux erreurs).
    listEtablissements()
      .then((l) => setCounts((c) => ({ ...c, etabs: l.length })))
      .catch(() => undefined)
    listArticles()
      .then((l) => setCounts((c) => ({ ...c, articles: l.length })))
      .catch(() => undefined)
    listEmployees()
      .then((l) => setCounts((c) => ({ ...c, employees: l.length })))
      .catch(() => undefined)
    listRawMaterials()
      .then((l) => setCounts((c) => ({ ...c, materials: l.length })))
      .catch(() => undefined)

    // CA du jour (total) + activité récente du 1er établissement.
    listMyEtablissements()
      .then(async (etabs) => {
        const days = await Promise.all(
          etabs.map((e) => getDay(e.id, today).catch(() => null)),
        )
        const total = days.reduce((sum, d) => sum + (d?.revenue ?? 0), 0)
        setCaJour(total)

        if (etabs.length > 0) {
          const first = etabs[0]
          setRecentEtab(first.name)
          const to = new Date()
          const from = new Date()
          from.setDate(from.getDate() - 6)
          const entries = await listMonth(first.id, toISODate(from), toISODate(to)).catch(() => [])
          setRecent([...entries].sort((a, b) => b.date.localeCompare(a.date)))
        }
      })
      .catch((e) => setError(errorMessage(e)))

    // Marges des articles fabriqués.
    listArticles()
      .then(async (list) => {
        const fabriques = list.filter((a) => a.type === 'FABRIQUE')
        const codeById = new Map(fabriques.map((a) => [a.id, a.code]))
        const results = await Promise.all(
          fabriques.map((a) =>
            getCost(a.id)
              .then((p) => p)
              .catch(() => null),
          ),
        )
        const rows: MarginRow[] = results
          .filter((p): p is Pnet => p !== null)
          .map((p) => ({
            id: p.articleId,
            code: codeById.get(p.articleId) ?? String(p.articleId),
            name: p.articleName,
            pnet: p.unitCost,
            pvTtc: p.salePriceTtc ?? null,
            marginHt: p.marginHt ?? null,
            coefficient: p.coefficient ?? null,
          }))
          .sort((a, b) => (b.coefficient ?? -Infinity) - (a.coefficient ?? -Infinity))
          .slice(0, 8)
        setMargins(rows)
      })
      .catch(() => undefined)
  }, [])

  return (
    <div className="page">
      <h1>Tableau de bord</h1>
      <p className="muted">Vue d'ensemble de votre enseigne.</p>

      {error && <div className="alert">{error}</div>}

      <div className="kpi-grid">
        <div className="card kpi">
          <span className="kpi-value">{counts.etabs}</span>
          <span className="kpi-label">Établissements</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{counts.articles}</span>
          <span className="kpi-label">Articles</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{counts.employees}</span>
          <span className="kpi-label">Employés</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{counts.materials}</span>
          <span className="kpi-label">Matières premières</span>
        </div>
        <div className="card kpi kpi-accent">
          <span className="kpi-value">{caJour == null ? '…' : formatEur(caJour)}</span>
          <span className="kpi-label">CA du jour (TTC, total)</span>
        </div>
      </div>

      <div className="grid grid-dash">
        <section className="card">
          <h2>Marges (articles fabriqués)</h2>
          {margins.length === 0 ? (
            <p className="muted">Aucune donnée de marge disponible.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Article</th>
                    <th>PNET (HT)</th>
                    <th>PV (TTC)</th>
                    <th>Marge €</th>
                    <th>Coef.</th>
                  </tr>
                </thead>
                <tbody>
                  {margins.map((m) => (
                    <tr key={m.id}>
                      <td data-label="Code">{m.code}</td>
                      <td data-label="Article">{m.name}</td>
                      <td data-label="PNET (HT)">{formatEur(m.pnet)}</td>
                      <td data-label="PV (TTC)">{formatEur(m.pvTtc)}</td>
                      <td data-label="Marge €">{formatEur(m.marginHt)}</td>
                      <td data-label="Coef.">
                        {m.coefficient == null ? '—' : m.coefficient.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Activité récente</h2>
          <p className="muted small">
            {recentEtab ? `7 derniers jours — ${recentEtab}` : 'Aucun établissement.'}
          </p>
          {recent.length === 0 ? (
            <p className="muted">Aucune saisie sur les 7 derniers jours.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Jour</th>
                    <th>CA (TTC)</th>
                    <th>Perte</th>
                    <th>Mot du jour</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.date}>
                      <td data-label="Jour">{formatDateFr(r.date)}</td>
                      <td data-label="CA (TTC)">{formatEur(r.revenue)}</td>
                      <td data-label="Perte">{formatEur(r.loss)}</td>
                      <td data-label="Mot du jour">{r.noteOfDay || '—'}</td>
                    </tr>
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
