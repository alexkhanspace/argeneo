import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SaveIcon from '@mui/icons-material/Save'
import { errorMessage } from '../../api/client'
import { getDay, listMyEtablissements, saveDay } from '../../api/daily'
import { todayIso } from '../../dashboard/analytics'
import type { MyEtablissement } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'

const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}
const longDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
const eur = (v: number): string =>
  v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

/**
 * Saisie « longue période » : on entre le CA puis les clients d'un jour, Entrée → enregistre et
 * passe au jour suivant. Idéal pour rattraper l'historique d'un nouveau client rapidement.
 */
export function SaisieRapidePage() {
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [etabId, setEtabId] = useState<number | null>(null)
  const [date, setDate] = useState(todayIso())
  const [ca, setCa] = useState('')
  const [clients, setClients] = useState('')
  const [losses, setLosses] = useState<{ articleId: number; quantity: number }[]>([])
  const [log, setLog] = useState<{ date: string; revenue: number; clients: number | null }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const caRef = useRef<HTMLInputElement>(null)
  const clientsRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listMyEtablissements()
      .then((l) => {
        setEtabs(l)
        if (l.length) setEtabId(l[0].id)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  // Charge le jour courant (pré-remplit s'il existe déjà) et place le focus sur le CA.
  useEffect(() => {
    if (etabId == null) return
    let cancelled = false
    getDay(etabId, date)
      .then((d) => {
        if (cancelled) return
        setCa(d.revenue == null ? '' : String(d.revenue))
        setClients(d.clientCount == null ? '' : String(d.clientCount))
        setLosses((d.losses ?? []).map((l) => ({ articleId: l.articleId, quantity: l.quantity })))
        caRef.current?.focus()
        caRef.current?.select()
      })
      .catch((e) => setError(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [etabId, date])

  const save = async (advance: number) => {
    if (etabId == null) return
    setBusy(true)
    setError(null)
    try {
      const revenue = ca ? Number(ca) : 0
      const clientCount = clients ? Number(clients) : null
      await saveDay(etabId, date, { revenue, clientCount, losses })
      setLog((prev) => [{ date, revenue, clients: clientCount }, ...prev].slice(0, 100))
      if (advance !== 0) setDate(addDays(date, advance))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Saisie longue période" />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <TextField
          select
          size="small"
          label="Établissement"
          value={etabId ?? ''}
          onChange={(e) => setEtabId(Number(e.target.value))}
          sx={{ minWidth: 180 }}
        >
          {etabs.length === 0 && <MenuItem value="">Aucun</MenuItem>}
          {etabs.map((e) => (
            <MenuItem key={e.id} value={e.id}>
              {e.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          size="small"
          label="Aller au jour"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <IconButton onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent">
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h6" sx={{ textTransform: 'capitalize', minWidth: 240, textAlign: 'center' }}>
              {longDate(date)}
            </Typography>
            <IconButton onClick={() => setDate(addDays(date, 1))} aria-label="Jour suivant">
              <ChevronRightIcon />
            </IconButton>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
            <TextField
              inputRef={caRef}
              label="CA (TTC)"
              type="number"
              value={ca}
              onChange={(e) => setCa(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  clientsRef.current?.focus()
                  clientsRef.current?.select()
                }
              }}
              slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
              autoFocus
              fullWidth
            />
            <TextField
              inputRef={clientsRef}
              label="Clients"
              type="number"
              value={clients}
              onChange={(e) => setClients(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void save(1)
                }
              }}
              slotProps={{ htmlInput: { step: '1', min: '0' } }}
              fullWidth
            />
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => void save(1)}
              disabled={busy}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Jour suivant
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Astuce : tape le CA → <b>Entrée</b> → tape les clients → <b>Entrée</b> ⇒ enregistré, on passe
            au lendemain. Les flèches changent de jour sans enregistrer.
          </Typography>
        </CardContent>
      </Card>

      {log.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Saisis dans cette session ({log.length})
            </Typography>
            <Stack divider={<Divider flexItem />} spacing={0}>
              {log.map((l, i) => (
                <Stack key={`${l.date}-${i}`} direction="row" sx={{ py: 0.75, gap: 2 }}>
                  <Typography sx={{ flex: 1, textTransform: 'capitalize' }} noWrap>
                    {longDate(l.date)}
                  </Typography>
                  <Typography sx={{ fontWeight: 600 }}>{eur(l.revenue)}</Typography>
                  <Typography color="text.secondary">{l.clients ?? '—'} cl.</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </>
  )
}
