import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'

export function AccountPage() {
  const { me } = useAuth()

  // Regroupe les autorités "code:boulangerieId" par boulangerie.
  const byBoulangerie = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const authority of me?.authorities ?? []) {
      const sep = authority.lastIndexOf(':')
      if (sep === -1) continue // ROLE_*
      const boulangerieId = authority.slice(sep + 1)
      const code = authority.slice(0, sep)
      const list = map.get(boulangerieId) ?? []
      list.push(code)
      map.set(boulangerieId, list)
    }
    return [...map.entries()]
  }, [me])

  if (!me) return null

  return (
    <div className="page">
      <h1>Mon compte</h1>
      <section className="card">
        <p>
          <strong>{me.fullName}</strong> — {me.email}
        </p>
        <p className="muted">Rôle : Employé</p>
      </section>

      <section className="card">
        <h2>Mes permissions par boulangerie</h2>
        {byBoulangerie.length === 0 ? (
          <p className="muted">Aucune permission attribuée pour le moment.</p>
        ) : (
          byBoulangerie.map(([boulangerieId, codes]) => (
            <div key={boulangerieId} className="perm-group">
              <h3>Boulangerie #{boulangerieId}</h3>
              <ul>
                {codes.sort().map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
