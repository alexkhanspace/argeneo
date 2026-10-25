import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner'
import { errorMessage } from '../../api/client'
import { listSheets, type SheetSummary } from '../../api/ordering'
import { PageHeader } from '../../components/PageHeader'
import { SearchField } from '../../components/SearchField'
import { matchesQuery } from '../../utils/text'

/** Liste des cadenciers fournisseurs (modèles de bon de commande). */
export function CadenciersPage() {
  const [sheets, setSheets] = useState<SheetSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    listSheets()
      .then(setSheets)
      .catch((e) => setError(errorMessage(e)))
  }, [])

  const visible = (sheets ?? []).filter((s) => matchesQuery(search, s.name, s.supplierName))

  return (
    <>
      <PageHeader
        title="Cadenciers"
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DocumentScannerIcon />}
              onClick={() => navigate('/commandes/cadenciers/new?import=1')}
            >
              Importer un cadencier papier
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/commandes/cadenciers/new')}>
              Nouveau
            </Button>
          </Stack>
        }
      />
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Un cadencier est la liste des produits que vous commandez chez un fournisseur. Créez-le à la main ou
        importez votre bon papier (photo ou PDF, une ou plusieurs pages) : l'IA recopie les lignes, vous
        relisez puis enregistrez.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {sheets && sheets.length > 0 && (
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un cadencier ou un fournisseur"
          sx={{ mb: 2, width: { xs: '100%', sm: 360 } }}
        />
      )}

      {sheets === null ? (
        <Typography color="text.secondary">Chargement…</Typography>
      ) : sheets.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              Aucun cadencier. Importez votre premier bon de commande papier ou créez-le à la main.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          {visible.map((s) => (
            <Card key={s.id} sx={{ opacity: s.active ? 1 : 0.6 }}>
              <CardActionArea component={Link} to={`/commandes/cadenciers/${s.id}`}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {s.name}
                  </Typography>
                  <Typography color="text.secondary">{s.supplierName ?? 'Fournisseur non renseigné'}</Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Chip size="small" label={`${s.lineCount} produit${s.lineCount > 1 ? 's' : ''}`} />
                    {!s.active && <Chip size="small" label="Archivé" variant="outlined" />}
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    </>
  )
}
