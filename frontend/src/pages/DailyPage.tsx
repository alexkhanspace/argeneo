import { useEffect, useState } from 'react'
import { errorMessage } from '../api/client'
import {
  getDay,
  listMonth,
  listMyEtablissements,
  setLoss,
  setNote,
  setRevenue,
} from '../api/daily'
import type { DailyEntry, MyEtablissement } from '../api/types'

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

function isoFor(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

export function DailyPage() {
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [etabId, setEtabId] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Mois affiché.
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-based
  const [entries, setEntries] = useState<Record<string, DailyEntry>>({})

  // Jour sélectionné + éditeur.
  const [selected, setSelected] = useState<string | null>(null)
  const [day, setDay] = useState<DailyEntry | null>(null)
  const [revenueInput, setRevenueInput] = useState('')
  const [lossInput, setLossInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [editorError, setEditorError] = useState<string | null>(null)
  const [editorOk, setEditorOk] = useState<string | null>(null)
  const [savingField, setSavingField] = useState<'revenue' | 'loss' | 'note' | null>(null)

  const todayIso = toISODate(now)
  const selectedEtab = etabs.find((e) => e.id === etabId) ?? null
  const can = (code: string) => selectedEtab?.permissions.includes(code) ?? false

  // Chargement des établissements.
  useEffect(() => {
    listMyEtablissements()
      .then((list) => {
        setEtabs(list)
        if (list.length > 0) setEtabId(list[0].id)
      })
      .catch((e) => setLoadError(errorMessage(e)))
  }, [])

  // Recharge le mois affiché.
  const refreshMonth = () => {
    if (etabId == null) return
    const from = isoFor(year, month, 1)
    const lastDay = new Date(year, month + 1, 0).getDate()
    const to = isoFor(year, month, lastDay)
    listMonth(etabId, from, to)
      .then((list) => {
        const map: Record<string, DailyEntry> = {}
        for (const e of list) map[e.date] = e
        setEntries(map)
      })
      .catch((e) => setLoadError(errorMessage(e)))
  }
  useEffect(refreshMonth, [etabId, year, month])

  // Charge le jour sélectionné dans l'éditeur.
  const loadDay = (iso: string) => {
    if (etabId == null) return
    setEditorError(null)
    setEditorOk(null)
    getDay(etabId, iso)
      .then((d) => {
        setDay(d)
        setRevenueInput(d.revenue == null ? '' : String(d.revenue))
        setLossInput(d.loss == null ? '' : String(d.loss))
        setNoteInput(d.noteOfDay ?? '')
      })
      .catch((e) => setEditorError(errorMessage(e)))
  }

  const onSelectDay = (iso: string) => {
    setSelected(iso)
    loadDay(iso)
  }

  const prevMonth = () => {
    setSelected(null)
    setDay(null)
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }
  const nextMonth = () => {
    setSelected(null)
    setDay(null)
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const afterSave = (msg: string) => {
    setEditorOk(msg)
    refreshMonth()
    if (selected) loadDay(selected)
  }

  const saveRevenue = async () => {
    if (etabId == null || !selected) return
    setSavingField('revenue')
    setEditorError(null)
    setEditorOk(null)
    try {
      await setRevenue(etabId, selected, Number(revenueInput || 0))
      afterSave('CA enregistré.')
    } catch (e) {
      setEditorError(errorMessage(e))
    } finally {
      setSavingField(null)
    }
  }
  const saveLoss = async () => {
    if (etabId == null || !selected) return
    setSavingField('loss')
    setEditorError(null)
    setEditorOk(null)
    try {
      await setLoss(etabId, selected, Number(lossInput || 0))
      afterSave('Perte enregistrée.')
    } catch (e) {
      setEditorError(errorMessage(e))
    } finally {
      setSavingField(null)
    }
  }
  const saveNote = async () => {
    if (etabId == null || !selected) return
    setSavingField('note')
    setEditorError(null)
    setEditorOk(null)
    try {
      await setNote(etabId, selected, noteInput)
      afterSave('Mot du jour enregistré.')
    } catch (e) {
      setEditorError(errorMessage(e))
    } finally {
      setSavingField(null)
    }
  }

  // Construction de la grille du mois.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7 // Lundi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="page">
      <h1>Calendrier &amp; saisie</h1>
      <p className="muted">CA (TTC), perte et mot du jour, par établissement.</p>

      {loadError && <div className="alert">{loadError}</div>}

      <div className="form-inline" style={{ marginBottom: '1.5rem' }}>
        <label style={{ maxWidth: 360 }}>
          Établissement
          <select
            value={etabId ?? ''}
            onChange={(e) => {
              setEtabId(Number(e.target.value))
              setSelected(null)
              setDay(null)
            }}
          >
            {etabs.length === 0 && <option value="">Aucun établissement</option>}
            {etabs.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="card">
        <div className="cal-header">
          <button className="btn-ghost small" onClick={prevMonth} aria-label="Mois précédent">
            ‹
          </button>
          <h2 style={{ margin: 0 }}>
            {MONTHS[month]} {year}
          </h2>
          <button className="btn-ghost small" onClick={nextMonth} aria-label="Mois suivant">
            ›
          </button>
        </div>

        <div className="calendar">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d == null) return <div key={`e${i}`} className="cal-cell cal-empty" />
            const iso = isoFor(year, month, d)
            const entry = entries[iso]
            const isToday = iso === todayIso
            const isSelected = iso === selected
            return (
              <button
                key={iso}
                className={`cal-cell${isToday ? ' cal-today' : ''}${
                  isSelected ? ' cal-selected' : ''
                }${entry ? ' cal-has' : ''}`}
                onClick={() => onSelectDay(iso)}
              >
                <span className="cal-num">{d}</span>
                {entry && (
                  <span className="cal-ca">
                    {entry.revenue != null ? formatEur(entry.revenue) : <span className="cal-dot" />}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {selected && (
        <section className="card">
          <h2>
            Saisie du{' '}
            {(() => {
              const [yy, mm, dd] = selected.split('-').map(Number)
              return new Date(yy, mm - 1, dd).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            })()}
          </h2>

          {editorError && <div className="alert">{editorError}</div>}
          {editorOk && <div className="success">{editorOk}</div>}

          <label>
            CA (TTC)
            <div className="save-row">
              <input
                type="number"
                step="0.01"
                min="0"
                value={revenueInput}
                disabled={!can('saisir_ca')}
                onChange={(e) => setRevenueInput(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={!can('saisir_ca') || savingField === 'revenue'}
                onClick={saveRevenue}
              >
                {savingField === 'revenue' ? '…' : 'Enregistrer'}
              </button>
            </div>
            {!can('saisir_ca') && <span className="small muted">Lecture seule</span>}
          </label>

          <label>
            Perte
            <div className="save-row">
              <input
                type="number"
                step="0.01"
                min="0"
                value={lossInput}
                disabled={!can('saisir_perte')}
                onChange={(e) => setLossInput(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={!can('saisir_perte') || savingField === 'loss'}
                onClick={saveLoss}
              >
                {savingField === 'loss' ? '…' : 'Enregistrer'}
              </button>
            </div>
            {!can('saisir_perte') && <span className="small muted">Lecture seule</span>}
          </label>

          <label>
            Mot du jour
            <textarea
              rows={3}
              value={noteInput}
              disabled={!can('saisir_mot_du_jour')}
              onChange={(e) => setNoteInput(e.target.value)}
            />
            <div className="save-row">
              <button
                className="btn-primary"
                disabled={!can('saisir_mot_du_jour') || savingField === 'note'}
                onClick={saveNote}
              >
                {savingField === 'note' ? '…' : 'Enregistrer le mot du jour'}
              </button>
            </div>
            {!can('saisir_mot_du_jour') && <span className="small muted">Lecture seule</span>}
          </label>

          {day?.updatedAt && (
            <p className="small muted">
              Dernière mise à jour : {new Date(day.updatedAt).toLocaleString('fr-FR')}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
