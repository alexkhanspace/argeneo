import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import UndoIcon from '@mui/icons-material/Undo'
import { errorMessage } from '../../api/client'
import { listOrders, receiveOrder, type OrderSummary } from '../../api/ordering'
import { PageHeader } from '../../components/PageHeader'

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Libellé d'un groupe de date : « En retard », « Aujourd'hui », « Demain », « mardi 28 octobre »… */
function groupLabel(key: string, today: string, tomorrow: string): string {
  if (key === 'late') return 'En retard'
  if (key === 'none') return 'Date de livraison inconnue'
  if (key === 'received') return 'Reçues (7 derniers jours)'
  if (key === today) return "Aujourd'hui"
  if (key === tomorrow) return 'Demain'
  return new Date(key + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Réceptions à venir : commandes validées rangées par date de livraison attendue (date demandée,
 * sinon prochain jour de livraison du fournisseur), avec pointage « Reçue ».
 */
export function ReceptionsPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [etab, setEtab] = useState<number | ''>('')
  const [showReceived, setShowReceived] = useState(false)

  useEffect(() => {
    listOrders()
      .then(setOrders)
      .catch((e) => setError(errorMessage(e)))
  }, [])

  const now = new Date()
  const today = iso(now)
  const tomorrow = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()

  const etabs = useMemo(() => {
    const map = new Map<number, string>()
    ;(orders ?? []).forEach((o) => {
      if (o.etablissementId != null) map.set(o.etablissementId, o.etablissementName ?? `#${o.etablissementId}`)
    })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [orders])

  // Groupes ordonnés : en retard, puis par date croissante, date inconnue, reçues récentes.
  const groups = useMemo(() => {
    const byKey = new Map<string, OrderSummary[]>()
    const push = (k: string, o: OrderSummary) => byKey.set(k, [...(byKey.get(k) ?? []), o])
    ;(orders ?? [])
      .filter((o) => etab === '' || o.etablissementId === etab)
      .forEach((o) => {
        if (o.status === 'VALIDEE') {
          if (!o.expectedDate) push('none', o)
          else if (o.expectedDate < today) push('late', o)
          else push(o.expectedDate, o)
        } else if (showReceived && o.status === 'RECUE' && o.receivedAt && o.receivedAt >= weekAgo) {
          push('received', o)
        }
      })
    const dated = [...byKey.keys()].filter((k) => /^\d{4}-/.test(k)).sort()
    return ['late', ...dated, 'none', 'received']
      .filter((k) => byKey.has(k))
      .map((k) => ({ key: k, orders: byKey.get(k) as OrderSummary[] }))
  }, [orders, etab, showReceived, today, weekAgo])

  const toggleReceived = async (o: OrderSummary, received: boolean) => {
    setBusyId(o.id)
    setError(null)
    try {
      const res = await receiveOrder(o.id, received)
      setOrders((list) =>
        (list ?? []).map((x) => (x.id === o.id ? { ...x, status: res.status, receivedAt: res.receivedAt } : x)),
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const pending = groups.filter((g) => g.key !== 'received').reduce((n, g) => n + g.orders.length, 0)

  return (
    <>
      <PageHeader title="Réceptions à venir" />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
        {etabs.length > 1 && (
          <TextField
            select
            size="small"
            label="Établissement"
            value={etab === '' ? '' : String(etab)}
            onChange={(e) => setEtab(e.target.value === '' ? '' : Number(e.target.value))}
            sx={{ maxWidth: { sm: 260 } }}
          >
            <MenuItem value="">Tous</MenuItem>
            {etabs.map(([id, name]) => (
              <MenuItem key={id} value={String(id)}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        )}
        <FormControlLabel
          control={<Switch checked={showReceived} onChange={(e) => setShowReceived(e.target.checked)} />}
          label="Afficher les reçues récentes"
        />
      </Stack>

      {orders === null ? (
        <Typography color="text.secondary">Chargement…</Typography>
      ) : pending === 0 && groups.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">Aucune livraison attendue. Les commandes validées apparaissent ici.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={3}>
          {groups.map((g) => (
            <Box key={g.key}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: 17,
                  mb: 1,
                  textTransform: 'capitalize',
                  color: g.key === 'late' ? 'error.main' : g.key === today ? 'primary.main' : 'text.primary',
                }}
              >
                {groupLabel(g.key, today, tomorrow)} <Chip size="small" label={g.orders.length} sx={{ ml: 0.5 }} />
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}>
                {g.orders.map((o) => {
                  const received = o.status === 'RECUE'
                  return (
                    <Card key={o.id} variant="outlined" sx={{ borderColor: g.key === 'late' ? 'error.light' : undefined }}>
                      <CardContent sx={{ pb: '12px !important' }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25 }}>{o.sheetName}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {o.etablissementName ?? '—'} · {o.lineCount} produit{o.lineCount > 1 ? 's' : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Commandé le {new Date(o.orderDate + 'T00:00:00').toLocaleDateString('fr-FR')}
                              {g.key === 'late' && o.expectedDate
                                ? ` · attendu le ${new Date(o.expectedDate + 'T00:00:00').toLocaleDateString('fr-FR')}`
                                : ''}
                              {received && o.receivedAt ? ` · reçue le ${new Date(o.receivedAt).toLocaleDateString('fr-FR')}` : ''}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                          <Button size="small" variant="outlined" onClick={() => navigate(`/commandes/${o.id}`)} sx={{ flex: 1 }}>
                            Voir
                          </Button>
                          {received ? (
                            <Button
                              size="small"
                              color="inherit"
                              startIcon={busyId === o.id ? <CircularProgress size={14} /> : <UndoIcon />}
                              onClick={() => void toggleReceived(o, false)}
                              disabled={busyId != null}
                              sx={{ flex: 1 }}
                            >
                              Annuler
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={busyId === o.id ? <CircularProgress size={14} color="inherit" /> : <CheckIcon />}
                              onClick={() => void toggleReceived(o, true)}
                              disabled={busyId != null}
                              sx={{ flex: 1 }}
                            >
                              Reçue
                            </Button>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  )
                })}
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </>
  )
}
