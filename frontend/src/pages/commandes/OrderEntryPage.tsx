import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Alert, Button, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteIcon from '@mui/icons-material/Delete'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import { errorMessage } from '../../api/client'
import { listMyEtablissements } from '../../api/daily'
import { deleteOrder, getOrder, getSheet, reopenOrder, type OrderSheet, type PurchaseOrder } from '../../api/ordering'
import { useAuth } from '../../auth/AuthContext'
import { isPatron } from '../../auth/roles'
import { OrderEntry } from './OrderEntry'

/** Saisie (nouvelle commande : ?sheet=&etab=) ou consultation / reprise d'une commande (/commandes/:id). */
export function OrderEntryPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { me } = useAuth()
  const patron = me ? isPatron(me) : false

  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [sheet, setSheet] = useState<OrderSheet | null>(null)
  const [etab, setEtab] = useState<{ id: number; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const existing = id ? await getOrder(Number(id)) : null
        const sheetId = existing?.sheetId ?? Number(params.get('sheet'))
        const etabId = existing?.etablissementId ?? Number(params.get('etab'))
        if (!sheetId) throw new Error('Le cadencier de cette commande a été supprimé.')
        const [s, etabs] = await Promise.all([getSheet(sheetId), listMyEtablissements()])
        const name = existing?.etablissementName ?? etabs.find((e) => e.id === etabId)?.name ?? 'Établissement'
        setOrder(existing)
        setSheet(s)
        setEtab({ id: etabId, name })
      } catch (e) {
        setError(errorMessage(e))
      }
    }
    void load()
  }, [id, params])

  const onReopen = async () => {
    if (!order) return
    try {
      setOrder(await reopenOrder(order.id))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const onDelete = async () => {
    if (!order || !window.confirm('Supprimer cette commande ?')) return
    try {
      await deleteOrder(order.id)
      navigate('/commandes')
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button component={Link} to="/commandes" variant="outlined" size="small" startIcon={<ArrowBackIcon />}>
          Commandes
        </Button>
        <Stack direction="row" sx={{ gap: 1 }}>
          {order?.status === 'VALIDEE' && patron && (
            <Button size="small" variant="outlined" startIcon={<LockOpenIcon />} onClick={() => void onReopen()}>
              Rouvrir
            </Button>
          )}
          {order && (order.status === 'BROUILLON' || patron) && (
            <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => void onDelete()}>
              Supprimer
            </Button>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {sheet && etab ? (
        <>
          <Typography variant="h1" gutterBottom>
            Commande {sheet.name} — {etab.name}
          </Typography>
          <OrderEntry
            // Remonte la saisie quand la commande change (création → id, réouverture).
            key={`${order?.id ?? 'new'}-${order?.status ?? ''}`}
            sheet={sheet}
            etablissement={etab}
            order={order}
            onSaved={(o) => {
              if (!order) navigate(`/commandes/${o.id}`, { replace: true })
            }}
          />
        </>
      ) : (
        !error && <Typography color="text.secondary">Chargement…</Typography>
      )}
    </>
  )
}
