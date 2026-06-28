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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SaveIcon from '@mui/icons-material/Save'
import { errorMessage } from '../../api/client'
import { listMyEtablissements, saveDay } from '../../api/daily'
import { todayIso } from '../../dashboard/analytics'
import type { MyEtablissement } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'

const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  // Date locale (toISOString décale d'un jour en fuseau France).
  const p = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
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
 * Saisie « longue période » : CA → clients → perte (€), Entrée enchaîne les champs puis enregistre
 * et passe au jour suivant. Idéal pour rattraper l'historique d'un nouveau client rapidement.
 */
export function SaisieRapidePage() {
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [etabId, setEtabId] = useState<number | null>(null)
  const [date, setDate] = useState(todayIso())
  const [ca, setCa] = useState('')
  const [clients, setClients] = useState('')
  const [loss, setLoss] = useState('')
  const [log, setLog] = useState<{ date: string; revenue: number; clients: number | null; loss: number | null }[]>([])
  const [busy, setBusy] = useState(false)
  const [dir, setDir] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const caRef = useRef<HTMLInputElement>(null)
  const clientsRef = useRef<HTMLInputElement>(null)
  const lossRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listMyEtablissements()
      .then((l) => {
        setEtabs(l)
        if (l.length) setEtabId(l[0].id)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  // Change de jour en vidant les champs et en redonnant le focus au CA (saisie en rafale).
  const goToDate = (d: string) => {
    setCa('')
    setClients('')
    setLoss('')
    setDate(d)
    requestAnimationFrame(() => {
      caRef.current?.focus()
      caRef.current?.select()
    })
  }

  const save = async () => {
    if (etabId == null) return
    // Jour laissé entièrement vide : on avance sans rien écraser.
    if (!ca && !clients && !loss) {
      goToDate(addDays(date, dir))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const revenue = ca ? Number(ca) : 0
      const clientCount = clients ? Number(clients) : null
      const lossAmount = loss ? Number(loss) : null
      await saveDay(etabId, date, { revenue, clientCount, losses: [], lossAmount })
      setLog((prev) => [{ date, revenue, clients: clientCount, loss: lossAmount }, ...prev].slice(0, 100))
      goToDate(addDays(date, dir))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const focusNext = (el: HTMLInputElement | null) => {
    el?.focus()
    el?.select()
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
          onChange={(e) => goToDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <ToggleButtonGroup size="small" exclusive value={dir} onChange={(_, v) => v != null && setDir(v)}>
          <ToggleButton value={1}>Avancer ▶</ToggleButton>
          <ToggleButton value={-1}>◀ Reculer</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <IconButton onClick={() => goToDate(addDays(date, -1))} aria-label="Jour précédent">
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h6" sx={{ textTransform: 'capitalize', minWidth: 240, textAlign: 'center' }}>
              {longDate(date)}
            </Typography>
            <IconButton onClick={() => goToDate(addDays(date, 1))} aria-label="Jour suivant">
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
                  focusNext(clientsRef.current)
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
                  focusNext(lossRef.current)
                }
              }}
              slotProps={{ htmlInput: { step: '1', min: '0' } }}
              fullWidth
            />
            <TextField
              inputRef={lossRef}
              label="Perte (€)"
              type="number"
              value={loss}
              onChange={(e) => setLoss(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void save()
                }
              }}
              slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
              fullWidth
            />
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={() => void save()}
              disabled={busy}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {dir > 0 ? 'Jour suivant' : 'Jour précédent'}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Astuce : CA → <b>Entrée</b> → Clients → <b>Entrée</b> → Perte → <b>Entrée</b> ⇒ enregistré, on
            passe au jour suivant. Les flèches changent de jour sans enregistrer.
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
                  <Typography color="error.main">{l.loss ? `-${eur(l.loss)}` : '—'}</Typography>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}
    </>
  )
}
