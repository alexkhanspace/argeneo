import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import TabletIcon from '@mui/icons-material/TabletMac'
import TruckIcon from '@mui/icons-material/LocalShipping'
import { errorMessage } from '../../api/client'
import { listMyEtablissements } from '../../api/daily'
import {
  listOrders,
  listSheets,
  ORDER_PERMISSION,
  STATUS_COLOR,
  STATUS_LABEL,
  type OrderSummary,
  type SheetSummary,
} from '../../api/ordering'
import type { MyEtablissement } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { isPatron } from '../../auth/roles'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'

const fmtDate = (iso: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR') : '—')
const eur = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

/** Historique des commandes fournisseurs + lancement d'une nouvelle commande. */
export function OrdersPage() {
  const { me } = useAuth()
  const patron = me ? isPatron(me) : false
  const navigate = useNavigate()
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'))
  const [orders, setOrders] = useState<OrderSummary[] | null>(null)
  const [sheets, setSheets] = useState<SheetSummary[]>([])
  const [etabs, setEtabs] = useState<MyEtablissement[]>([])
  const [error, setError] = useState<string | null>(null)

  const [filterEtab, setFilterEtab] = useState<number | ''>('')
  const [filterSheet, setFilterSheet] = useState<number | ''>('')

  const [newOpen, setNewOpen] = useState(false)
  const [newEtab, setNewEtab] = useState<number | ''>('')
  const [newSheet, setNewSheet] = useState<number | ''>('')

  useEffect(() => {
    listOrders().then(setOrders).catch((e) => setError(errorMessage(e)))
    listSheets().then((s) => setSheets(s.filter((x) => x.active))).catch(() => undefined)
    listMyEtablissements()
      .then((list) => {
        const allowed = list.filter((e) => e.permissions.includes(ORDER_PERMISSION))
        setEtabs(allowed)
        if (allowed.length === 1) setNewEtab(allowed[0].id)
      })
      .catch(() => undefined)
  }, [])

  const visible = useMemo(
    () =>
      (orders ?? []).filter(
        (o) => (filterEtab === '' || o.etablissementId === filterEtab) && (filterSheet === '' || o.sheetId === filterSheet),
      ),
    [orders, filterEtab, filterSheet],
  )

  const start = () => {
    if (newEtab === '' || newSheet === '') return
    navigate(`/commandes/saisie?sheet=${newSheet}&etab=${newEtab}`)
  }

  return (
    <>
      <PageHeader
        title="Commandes fournisseurs"
        action={
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<TruckIcon />} component={Link} to="/commandes/receptions">
              Réceptions
            </Button>
            <Button variant="outlined" startIcon={<TabletIcon />} component={Link} to="/tablette/commandes">
              Mode tablette
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewOpen(true)}>
              Nouvelle commande
            </Button>
          </Stack>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {sheets.length === 0 && orders !== null && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Aucun cadencier actif.{' '}
          {patron ? (
            <Link to="/commandes/cadenciers">Créez ou importez un cadencier</Link>
          ) : (
            'Demandez au patron de créer les cadenciers fournisseurs.'
          )}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2, maxWidth: { sm: 560 } }}>
            {etabs.length > 1 && (
              <TextField
                select
                size="small"
                label="Établissement"
                value={filterEtab === '' ? '' : String(filterEtab)}
                onChange={(e) => setFilterEtab(e.target.value === '' ? '' : Number(e.target.value))}
                sx={{ flex: 1 }}
              >
                <MenuItem value="">Tous</MenuItem>
                {etabs.map((e) => (
                  <MenuItem key={e.id} value={String(e.id)}>
                    {e.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              select
              size="small"
              label="Fournisseur"
              value={filterSheet === '' ? '' : String(filterSheet)}
              onChange={(e) => setFilterSheet(e.target.value === '' ? '' : Number(e.target.value))}
              sx={{ flex: 1 }}
            >
              <MenuItem value="">Tous</MenuItem>
              {sheets.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {orders === null ? (
            <Typography color="text.secondary">Chargement…</Typography>
          ) : visible.length === 0 ? (
            <Typography color="text.secondary">Aucune commande.</Typography>
          ) : phone ? (
            // Téléphone : une carte par commande plutôt qu'un tableau à faire défiler.
            <Stack spacing={1}>
              {visible.map((o) => (
                <Card key={o.id} variant="outlined" onClick={() => navigate(`/commandes/${o.id}`)} sx={{ cursor: 'pointer' }}>
                  <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                      <Typography sx={{ fontWeight: 700 }} noWrap>
                        {o.sheetName}
                      </Typography>
                      <Chip size="small" label={STATUS_LABEL[o.status]} color={STATUS_COLOR[o.status]} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {fmtDate(o.orderDate)} · {o.etablissementName ?? '—'} · {o.lineCount} produit{o.lineCount > 1 ? 's' : ''}
                    </Typography>
                    {(o.deliveryDate ?? o.expectedDate) && (
                      <Typography variant="caption" color="text.secondary">
                        Livraison {fmtDate(o.deliveryDate ?? o.expectedDate)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Fournisseur</TableCell>
                    <TableCell>Établissement</TableCell>
                    <TableCell>Livraison</TableCell>
                    <TableCell align="right">Produits</TableCell>
                    <TableCell align="right">Montant ≈</TableCell>
                    <TableCell>Par</TableCell>
                    <TableCell>Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.map((o) => (
                    <TableRow key={o.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/commandes/${o.id}`)}>
                      <TableCell>{fmtDate(o.orderDate)}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{o.sheetName}</TableCell>
                      <TableCell>{o.etablissementName ?? '—'}</TableCell>
                      <TableCell>{fmtDate(o.deliveryDate ?? o.expectedDate)}</TableCell>
                      <TableCell align="right">{o.lineCount}</TableCell>
                      <TableCell align="right">{eur(o.totalAmount)}</TableCell>
                      <TableCell>{o.createdByName ?? '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={STATUS_LABEL[o.status]} color={STATUS_COLOR[o.status]} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nouvelle commande">
        <Stack spacing={2} sx={{ mt: 1 }}>
          {etabs.length === 0 && (
            <Alert severity="warning">Vous n'avez le droit de commander pour aucun établissement.</Alert>
          )}
          <TextField
            select
            label="Établissement (lieu de livraison)"
            value={newEtab === '' ? '' : String(newEtab)}
            onChange={(e) => setNewEtab(Number(e.target.value))}
          >
            {etabs.map((e) => (
              <MenuItem key={e.id} value={String(e.id)}>
                {e.name}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
            {sheets.map((s) => (
              <Button
                key={s.id}
                variant={newSheet === s.id ? 'contained' : 'outlined'}
                onClick={() => setNewSheet(s.id)}
                sx={{ py: 1.5, justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{s.name}</Typography>
                  <Typography variant="caption">{s.lineCount} produits</Typography>
                </Box>
              </Button>
            ))}
          </Box>
          <Button variant="contained" onClick={start} disabled={newEtab === '' || newSheet === ''}>
            Commencer la saisie
          </Button>
        </Stack>
      </Modal>
    </>
  )
}
