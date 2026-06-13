import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import {
  assignPermissions,
  getUserPermissions,
  listBoulangeries,
  listPermissions,
  listPresets,
} from '../../api/iam'
import type { Boulangerie, Permission, Preset, UserPermissions } from '../../api/types'

export function EmployeePermissionsPage() {
  const { id } = useParams()
  const userId = Number(id)

  const [boulangeries, setBoulangeries] = useState<Boulangerie[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [userPerms, setUserPerms] = useState<UserPermissions | null>(null)

  const [selected, setSelected] = useState<number | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Chargement initial.
  useEffect(() => {
    Promise.all([listBoulangeries(), listPermissions(), listPresets(), getUserPermissions(userId)])
      .then(([b, p, pr, up]) => {
        setBoulangeries(b)
        setPermissions(p)
        setPresets(pr)
        setUserPerms(up)
        if (b.length > 0) setSelected(b[0].id)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [userId])

  // À chaque changement de boulangerie sélectionnée, on recharge les droits courants.
  useEffect(() => {
    if (selected == null || !userPerms) return
    const current = userPerms.boulangeries.find((x) => x.boulangerieId === selected)
    setChecked(new Set(current?.permissionCodes ?? []))
    setSaved(false)
  }, [selected, userPerms])

  const byCategory = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const perm of permissions) {
      const list = map.get(perm.category) ?? []
      list.push(perm)
      map.set(perm.category, list)
    }
    return [...map.entries()]
  }, [permissions])

  const toggle = (code: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
    setSaved(false)
  }

  const applyPreset = (preset: Preset) => {
    setChecked(new Set(preset.permissionCodes))
    setSaved(false)
  }

  const save = async () => {
    if (selected == null) return
    setError(null)
    setBusy(true)
    try {
      await assignPermissions(userId, selected, [...checked])
      const refreshed = await getUserPermissions(userId)
      setUserPerms(refreshed)
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (boulangeries.length === 0) {
    return (
      <div className="page">
        <h1>Permissions</h1>
        <p className="muted">Créez d'abord au moins une boulangerie.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Permissions de l'employé #{userId}</h1>
      <p className="muted">
        Les droits sont attribués <strong>par boulangerie</strong> : un employé peut être manager
        ici et vendeur ailleurs.
      </p>

      <div className="tabs">
        {boulangeries.map((b) => (
          <button
            key={b.id}
            className={`tab ${selected === b.id ? 'active' : ''}`}
            onClick={() => setSelected(b.id)}
          >
            {b.name}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="presets">
          <span className="muted small">Presets :</span>
          {presets.map((preset) => (
            <button key={preset.code} className="btn-ghost small" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
          <button className="btn-ghost small" onClick={() => setChecked(new Set())}>
            Tout décocher
          </button>
        </div>

        <div className="perm-groups">
          {byCategory.map(([category, perms]) => (
            <div key={category} className="perm-group">
              <h3>{category}</h3>
              {perms.map((perm) => (
                <label key={perm.code} className="checkbox">
                  <input
                    type="checkbox"
                    checked={checked.has(perm.code)}
                    onChange={() => toggle(perm.code)}
                  />
                  {perm.label}
                </label>
              ))}
            </div>
          ))}
        </div>

        {error && <div className="alert">{error}</div>}
        {saved && <div className="success">Permissions enregistrées.</div>}

        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </section>
    </div>
  )
}
