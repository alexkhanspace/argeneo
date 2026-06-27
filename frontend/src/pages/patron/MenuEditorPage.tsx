import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { errorMessage } from '../../api/client'
import { getArticle, getCost, getMenu, listArticles, saveMenu } from '../../api/costing'
import type { Article, Pnet } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'

function formatEur(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })
}

interface Row {
  componentArticleId: number | ''
  quantity: string
}

export function MenuEditorPage() {
  const { id } = useParams()
  const articleId = Number(id)

  const [article, setArticle] = useState<Article | null>(null)
  const [candidates, setCandidates] = useState<Article[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [pnet, setPnet] = useState<Pnet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  const refreshCost = () => {
    getCost(articleId)
      .then(setPnet)
      .catch(() => setPnet(null))
  }

  useEffect(() => {
    getArticle(articleId).then(setArticle).catch((e) => setError(errorMessage(e)))
    listArticles()
      .then((all) => setCandidates(all.filter((a) => a.id !== articleId && a.type !== 'MENU')))
      .catch(() => undefined)
    getMenu(articleId)
      .then((items) =>
        setRows(
          items.length
            ? items.map((i) => ({ componentArticleId: i.componentArticleId, quantity: String(i.quantity) }))
            : [{ componentArticleId: '', quantity: '1' }],
        ),
      )
      .catch((e) => setError(errorMessage(e)))
    refreshCost()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId])

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows((rs) => [...rs, { componentArticleId: '', quantity: '1' }])
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const onSave = async () => {
    setError(null)
    setBusy(true)
    try {
      const items = rows
        .filter((r) => r.componentArticleId !== '' && Number(r.quantity) > 0)
        .map((r) => ({ componentArticleId: Number(r.componentArticleId), quantity: Number(r.quantity) }))
      await saveMenu(articleId, items)
      setSavedOk(true)
      refreshCost()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title={article ? `Menu — ${article.name}` : 'Menu'}
        action={
          <Stack direction="row" spacing={1}>
            <Button component={Link} to="/articles" variant="outlined" size="small" startIcon={<ArrowBackIcon />}>
              Articles
            </Button>
            <Button variant="contained" size="small" onClick={onSave} disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </Stack>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, gap: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Composition
            </Typography>
            <Stack spacing={1.5}>
              {rows.map((r, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <TextField
                    select
                    label="Article"
                    value={r.componentArticleId === '' ? '' : String(r.componentArticleId)}
                    onChange={(e) =>
                      setRow(i, { componentArticleId: e.target.value === '' ? '' : Number(e.target.value) })
                    }
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {candidates.map((a) => (
                      <MenuItem key={a.id} value={String(a.id)}>
                        {a.code} — {a.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Qté"
                    type="number"
                    value={r.quantity}
                    onChange={(e) => setRow(i, { quantity: e.target.value })}
                    slotProps={{ htmlInput: { step: '1', min: '0' } }}
                    sx={{ width: { xs: 80, sm: 100 }, flexShrink: 0 }}
                  />
                  <Tooltip title="Retirer">
                    <IconButton size="small" color="error" onClick={() => removeRow(i)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
              <Button startIcon={<AddIcon />} onClick={addRow} sx={{ alignSelf: 'flex-start' }}>
                Ajouter un article
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Coût & marge
            </Typography>
            {pnet ? (
              <Stack spacing={1}>
                <Typography variant="body2">
                  PNET (somme des composants) : <strong>{formatEur(pnet.unitCost)}</strong>
                </Typography>
                <Typography variant="body2">
                  PV TTC : <strong>{formatEur(article?.salePriceTtc ?? pnet.salePriceTtc)}</strong>
                </Typography>
                <Typography variant="body2">
                  Marge HT : {formatEur(pnet.marginHt)}
                  {pnet.coefficient != null ? ` — coef ×${pnet.coefficient.toFixed(2)}` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Le prix de vente du menu se règle dans la fiche article (souvent remisé vs la somme des parts).
                </Typography>
              </Stack>
            ) : (
              <Typography color="text.secondary">
                Enregistrez la composition pour calculer le coût.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      <Snackbar
        open={savedOk}
        autoHideDuration={2500}
        onClose={() => setSavedOk(false)}
        message="Menu enregistré"
      />
    </>
  )
}
