import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { errorMessage } from '../../api/client'
import { listEtablissements } from '../../api/iam'
import type { Etablissement } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'

export function EtablissementsPage() {
  const [items, setItems] = useState<Etablissement[]>([])
  const [error, setError] = useState<string | null>(null)

  // Mobile : liste de fiches (lecture seule) au lieu du tableau.
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  useEffect(() => {
    listEtablissements().then(setItems).catch((e) => setError(errorMessage(e)))
  }, [])

  const columns: GridColDef<Etablissement>[] = [
    { field: 'id', headerName: '#', width: 80 },
    { field: 'name', headerName: 'Nom', flex: 1, minWidth: 160 },
    {
      field: 'address',
      headerName: 'Adresse',
      flex: 1,
      minWidth: 200,
      valueGetter: (value) => (value as string | null) ?? '—',
    },
  ]

  return (
    <>
      <PageHeader
        title="Établissements"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h2" gutterBottom>
            Mes établissements ({items.length})
          </Typography>
          {items.length === 0 ? (
            <Typography color="text.secondary">Aucun établissement pour le moment.</Typography>
          ) : isMobile ? (
            <Stack spacing={1.5}>
              {items.map((e) => (
                <Card key={e.id} variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>{e.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        #{e.id}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {e.address ?? '—'}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <Box sx={{ height: 480, width: '100%' }}>
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
    </>
  )
}
