import { useEffect, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import FlagIcon from '@mui/icons-material/Flag'
import SettingsIcon from '@mui/icons-material/Settings'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import type { ChipProps } from '@mui/material'
import { errorMessage } from '../../api/client'
import {
  convertToFacture,
  deleteDocument,
  DOCUMENT_STATUS_LABELS,
  fetchDocumentPdf,
  listDocuments,
  setDocumentStatus,
  type BillingDocument,
  type DocumentStatus,
  type DocumentType,
} from '../../api/billing'
import { PageHeader } from '../../components/PageHeader'
import { PdfViewerModal } from '../../components/PdfViewerModal'

type Filter = 'ALL' | DocumentType

const STATUS_COLOR: Record<DocumentStatus, ChipProps['color']> = {
  BROUILLON: 'default',
  EMIS: 'info',
  ACCEPTE: 'success',
  REFUSE: 'error',
  PAYE: 'success',
  ANNULE: 'warning',
}

const STATUS_OPTIONS: DocumentStatus[] = [
  'BROUILLON',
  'EMIS',
  'ACCEPTE',
  'REFUSE',
  'PAYE',
  'ANNULE',
]

function formatEur(value: number): string {
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export function BillingPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [mobileSort, setMobileSort] = useState<'date' | 'amount'>('date')
  const [items, setItems] = useState<BillingDocument[]>([])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [listError, setListError] = useState<string | null>(null)
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null)
  const [statusTarget, setStatusTarget] = useState<BillingDocument | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [pdfView, setPdfView] = useState<{ blob: Blob | null; name: string; title: string } | null>(null)

  const refresh = () => {
    listDocuments(filter === 'ALL' ? undefined : filter)
      .then(setItems)
      .catch((e) => setListError(errorMessage(e)))
  }
  useEffect(refresh, [filter])

  const onConvert = async (doc: BillingDocument) => {
    if (!window.confirm(`Convertir le devis ${doc.number ?? ''} en facture ?`)) return
    try {
      const facture = await convertToFacture(doc.id)
      navigate(`/billing/documents/${facture.id}`)
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  const onDelete = async (doc: BillingDocument) => {
    if (!window.confirm('Supprimer ce brouillon ?')) return
    try {
      await deleteDocument(doc.id)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  const onDownloadPdf = async (doc: BillingDocument) => {
    setDownloadingId(doc.id)
    try {
      const prefix = doc.type === 'FACTURE' ? 'facture' : 'devis'
      const blob = await fetchDocumentPdf(doc.id)
      setPdfView({
        blob,
        name: `${prefix}-${doc.number ?? doc.id}.pdf`,
        title: doc.type === 'FACTURE' ? 'Facture' : 'Devis',
      })
    } catch (err) {
      setListError(errorMessage(err))
    } finally {
      setDownloadingId(null)
    }
  }

  const openStatusMenu = (e: MouseEvent<HTMLElement>, doc: BillingDocument) => {
    setStatusTarget(doc)
    setStatusAnchor(e.currentTarget)
  }

  const applyStatus = async (status: DocumentStatus) => {
    if (!statusTarget) return
    const target = statusTarget
    setStatusAnchor(null)
    setStatusTarget(null)
    try {
      await setDocumentStatus(target.id, status)
      refresh()
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  // Tri pour la vue cartes mobile (le tableau desktop gère son tri lui-même).
  const sortedMobileItems = [...items].sort((a, b) => {
    if (mobileSort === 'amount') return (b.totalTtc ?? -Infinity) - (a.totalTtc ?? -Infinity)
    const da = a.issueDate ? new Date(a.issueDate).getTime() : -Infinity
    const db = b.issueDate ? new Date(b.issueDate).getTime() : -Infinity
    return db - da
  })

  const columns: GridColDef<BillingDocument>[] = [
    {
      field: 'number',
      headerName: 'Numéro',
      width: 140,
      renderCell: (p) => (p.row.number ? p.row.number : <em>Brouillon</em>),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 110,
      type: 'singleSelect',
      valueOptions: ['Devis', 'Facture'],
      valueGetter: (_v, row) => (row.type === 'DEVIS' ? 'Devis' : 'Facture'),
      renderCell: (p) => <Chip label={p.value as string} size="small" variant="outlined" />,
    },
    {
      field: 'clientName',
      headerName: 'Client',
      flex: 1,
      minWidth: 160,
      valueGetter: (_v, row) => row.clientName ?? '—',
    },
    {
      field: 'issueDate',
      headerName: 'Date',
      width: 120,
      valueGetter: (_v, row) =>
        row.issueDate ? new Date(row.issueDate).toLocaleDateString('fr-FR') : '—',
    },
    {
      field: 'status',
      headerName: 'Statut',
      width: 130,
      type: 'singleSelect',
      valueOptions: STATUS_OPTIONS.map((s) => DOCUMENT_STATUS_LABELS[s]),
      valueGetter: (_v, row) => DOCUMENT_STATUS_LABELS[row.status],
      renderCell: (p) => (
        <Chip
          size="small"
          label={DOCUMENT_STATUS_LABELS[p.row.status]}
          color={STATUS_COLOR[p.row.status]}
        />
      ),
    },
    {
      field: 'totalTtc',
      headerName: 'Total TTC',
      width: 120,
      type: 'number',
      valueFormatter: (v) => formatEur(v as number),
    },
    {
      field: 'actions',
      headerName: '',
      width: 180,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (p) => (
        <Stack direction="row" sx={{ gap: 0.5, justifyContent: 'flex-end', width: '100%' }}>
          <Tooltip title="Éditer">
            <IconButton
              size="small"
              onClick={() => navigate(`/billing/documents/${p.row.id}`)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Télécharger le PDF">
            <IconButton
              size="small"
              onClick={() => onDownloadPdf(p.row)}
              disabled={downloadingId === p.row.id}
            >
              <PictureAsPdfIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Changer le statut">
            <IconButton size="small" onClick={(e) => openStatusMenu(e, p.row)}>
              <FlagIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {p.row.type === 'DEVIS' && (
            <Tooltip title="Convertir en facture">
              <IconButton size="small" color="primary" onClick={() => onConvert(p.row)}>
                <SwapHorizIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {p.row.status === 'BROUILLON' && (
            <Tooltip title="Supprimer">
              <IconButton size="small" color="error" onClick={() => onDelete(p.row)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Facturation"
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Paramètres de facturation">
              <IconButton onClick={() => navigate('/billing/settings')}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => navigate('/billing/documents/new?type=DEVIS')}
            >
              Nouveau devis
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/billing/documents/new?type=FACTURE')}
            >
              Nouvelle facture
            </Button>
          </Stack>
        }
      />

      {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

      <ToggleButtonGroup
        size="small"
        exclusive
        value={filter}
        onChange={(_, v) => v && setFilter(v)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="ALL">Tous</ToggleButton>
        <ToggleButton value="DEVIS">Devis</ToggleButton>
        <ToggleButton value="FACTURE">Factures</ToggleButton>
      </ToggleButtonGroup>

      <Card>
        <CardContent>
          {items.length === 0 ? (
            <Typography color="text.secondary">Aucun document.</Typography>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              <TextField
                select
                size="small"
                label="Trier par"
                value={mobileSort}
                onChange={(e) => setMobileSort(e.target.value as 'date' | 'amount')}
                sx={{ maxWidth: 200 }}
              >
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="amount">Montant</MenuItem>
              </TextField>
              {sortedMobileItems.map((doc) => (
                <Card
                  key={doc.id}
                  variant="outlined"
                  onClick={() => navigate(`/billing/documents/${doc.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                    >
                      <Typography sx={{ fontWeight: 700 }}>
                        {doc.number ?? <em>Brouillon</em>}
                      </Typography>
                      <Chip
                        size="small"
                        label={DOCUMENT_STATUS_LABELS[doc.status]}
                        color={STATUS_COLOR[doc.status]}
                      />
                      <Chip
                        label={doc.type === 'DEVIS' ? 'Devis' : 'Facture'}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {doc.clientName ?? '—'}
                      {' · '}
                      {doc.issueDate
                        ? new Date(doc.issueDate).toLocaleDateString('fr-FR')
                        : '—'}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: 'primary.main', mt: 0.5 }}>
                      {formatEur(doc.totalTtc)}
                    </Typography>
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                      <IconButton
                        size="small"
                        aria-label="Éditer"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/billing/documents/${doc.id}`)
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Télécharger le PDF"
                        disabled={downloadingId === doc.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDownloadPdf(doc)
                        }}
                      >
                        <PictureAsPdfIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Changer le statut"
                        onClick={(e) => {
                          e.stopPropagation()
                          openStatusMenu(e, doc)
                        }}
                      >
                        <FlagIcon fontSize="small" />
                      </IconButton>
                      {doc.type === 'DEVIS' && (
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label="Convertir en facture"
                          onClick={(e) => {
                            e.stopPropagation()
                            onConvert(doc)
                          }}
                        >
                          <SwapHorizIcon fontSize="small" />
                        </IconButton>
                      )}
                      {doc.status === 'BROUILLON' && (
                        <IconButton
                          size="small"
                          color="error"
                          aria-label="Supprimer"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(doc)
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={items}
                columns={columns}
                showToolbar
                disableRowSelectionOnClick
                sortingOrder={['asc', 'desc', null]}
                pageSizeOptions={[25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                sx={{ border: 0 }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      <Menu
        open={Boolean(statusAnchor)}
        anchorEl={statusAnchor}
        onClose={() => {
          setStatusAnchor(null)
          setStatusTarget(null)
        }}
      >
        {STATUS_OPTIONS.map((s) => (
          <MenuItem
            key={s}
            selected={statusTarget?.status === s}
            onClick={() => applyStatus(s)}
          >
            {DOCUMENT_STATUS_LABELS[s]}
          </MenuItem>
        ))}
      </Menu>

      <PdfViewerModal
        open={pdfView != null}
        onClose={() => setPdfView(null)}
        blob={pdfView?.blob ?? null}
        filename={pdfView?.name ?? 'document.pdf'}
        title={pdfView?.title}
      />
    </>
  )
}
