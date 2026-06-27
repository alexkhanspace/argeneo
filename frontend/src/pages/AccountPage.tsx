import { useMemo } from 'react'
import { Box, Card, CardContent, List, ListItem, ListItemText, Typography } from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/PageHeader'

export function AccountPage() {
  const { me } = useAuth()

  // Regroupe les autorités "code:etablissementId" par etablissement.
  const byEtablissement = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const authority of me?.authorities ?? []) {
      const sep = authority.lastIndexOf(':')
      if (sep === -1) continue // ROLE_*
      const etablissementId = authority.slice(sep + 1)
      const code = authority.slice(0, sep)
      const list = map.get(etablissementId) ?? []
      list.push(code)
      map.set(etablissementId, list)
    }
    return [...map.entries()]
  }, [me])

  if (!me) return null

  return (
    <>
      <PageHeader title="Mon compte" />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography>
            <strong>{me.fullName}</strong> — {me.email}
          </Typography>
          <Typography color="text.secondary">Rôle : Employé</Typography>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h2" gutterBottom>
            Mes permissions par Établissement
          </Typography>
          {byEtablissement.length === 0 ? (
            <Typography color="text.secondary">
              Aucune permission attribuée pour le moment.
            </Typography>
          ) : (
            byEtablissement.map(([etablissementId, codes]) => (
              <Box key={etablissementId} sx={{ mb: 2 }}>
                <Typography variant="h3">Etablissement #{etablissementId}</Typography>
                <List dense disablePadding>
                  {codes.sort().map((code) => (
                    <ListItem key={code} disablePadding>
                      <ListItemText primary={code} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ))
          )}
        </CardContent>
      </Card>
    </>
  )
}
