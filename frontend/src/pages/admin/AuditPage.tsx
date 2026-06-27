import { useEffect, useState } from 'react'
import { Alert, Card, Chip } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { errorMessage } from '../../api/client'
import { listAudit } from '../../api/audit'
import type { AuditEvent } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'

/** Couleur de puce selon la famille d'action. */
function actionColor(action: string): 'success' | 'error' | 'warning' | 'info' | 'default' {
  if (action.startsWith('LOGIN_SUCCESS') || action.endsWith('_CREATE')) return 'success'
  if (action.startsWith('LOGIN_FAILURE') || action.endsWith('_DELETE') || action.endsWith('_ARCHIVE') || action.endsWith('_DEACTIVATE'))
    return 'error'
  if (action.startsWith('IMPERSONATE')) return 'warning'
  if (action.endsWith('_UPDATE') || action.endsWith('_RESTORE')) return 'info'
  return 'default'
}

const columns: GridColDef<AuditEvent>[] = [
  {
    field: 'occurredAt',
    headerName: 'Date',
    width: 170,
    valueFormatter: (value) =>
      value ? new Date(value as string).toLocaleString('fr-FR') : '',
  },
  {
    field: 'action',
    headerName: 'Action',
    width: 170,
    renderCell: (params) => (
      <Chip label={params.value as string} size="small" color={actionColor(params.value as string)} variant="outlined" />
    ),
  },
  { field: 'actorEmail', headerName: 'Acteur', width: 220 },
  { field: 'tenantName', headerName: 'Enseigne', width: 160 },
  {
    field: 'target',
    headerName: 'Cible',
    width: 140,
    valueGetter: (_value, row) =>
      row.targetType ? `${row.targetType}${row.targetId ? ` #${row.targetId}` : ''}` : '—',
  },
  { field: 'summary', headerName: 'Détail', flex: 1, minWidth: 200 },
]

export function AuditPage() {
  const [rows, setRows] = useState<AuditEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listAudit({ limit: 500 })
      .then(setRows)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <PageHeader
        title="Historique d'usage"
      />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card sx={{ height: 640 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
          sx={{ border: 0 }}
        />
      </Card>
    </>
  )
}
