import { useState } from 'react'
import {
  Avatar,
  Backdrop,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import CalculateIcon from '@mui/icons-material/Calculate'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CampaignIcon from '@mui/icons-material/Campaign'
import DeleteIcon from '@mui/icons-material/Delete'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { errorMessage } from '../api/client'
import { photoUrl } from '../api/costing'
import { buildRecipePdfBlob } from '../pdf/buildRecipePdf'
import type { Article } from '../api/types'
import { Modal } from './Modal'
import { PdfViewerModal } from './PdfViewerModal'

const fmt = (v: number | null | undefined): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })

const typeLabel = (t: Article['type']): string =>
  t === 'FABRIQUE' ? 'Fabriqué' : t === 'MENU' ? 'Menu' : 'Acheté'

export function ProductSheet({
  open,
  onClose,
  article,
  unitCost,
  coefficient,
  genBusy,
  onEdit,
  onRecipe,
  onMenu,
  onCalc,
  onPub,
  onGeneratePhoto,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  article: Article
  unitCost: number | null
  coefficient: number | null
  genBusy: boolean
  onEdit: () => void
  onRecipe: () => void
  onMenu: () => void
  onCalc: () => void
  onPub: () => void
  onGeneratePhoto: () => void
  onDelete: () => void
}) {
  const marginHt =
    article.salePriceHt != null && unitCost != null ? article.salePriceHt - unitCost : null

  const [pdf, setPdf] = useState<{ blob: Blob | null; name: string; title: string } | null>(null)
  const [pdfBusy, setPdfBusy] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  // Photo en plein écran (lightbox) au clic sur la vignette.
  const [photoFull, setPhotoFull] = useState(false)

  const exportRecipePdf = async (mode: 'cost' | 'prep') => {
    setPdfError(null)
    setPdfBusy(mode)
    try {
      const blob = await buildRecipePdfBlob(article.id, mode)
      setPdf({
        blob,
        name: `${article.code}-${mode === 'cost' ? 'cout' : 'preparation'}.pdf`,
        title: mode === 'cost' ? 'Fiche coût' : 'Fiche préparation',
      })
    } catch (e) {
      setPdfError(errorMessage(e))
    } finally {
      setPdfBusy(null)
    }
  }

  const stat = (label: string, value: string) => (
    <Box sx={{ flex: 1, minWidth: 90, textAlign: 'center', py: 1, px: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700 }}>{value}</Typography>
    </Box>
  )

  return (
    <Modal open={open} onClose={onClose} title={article.name}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          {article.photoFile ? (
            <Avatar
              variant="rounded"
              src={photoUrl(article.photoFile) ?? undefined}
              alt={article.name}
              onClick={() => setPhotoFull(true)}
              sx={{ width: 96, height: 96, flexShrink: 0, cursor: 'zoom-in' }}
            />
          ) : (
            <Avatar variant="rounded" sx={{ width: 96, height: 96, flexShrink: 0, bgcolor: 'action.hover', color: 'text.disabled' }}>
              ?
            </Avatar>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Box component="code" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                {article.code}
              </Box>
              <Chip label={typeLabel(article.type)} size="small" variant="outlined" />
              {article.gtin && (
                <Typography variant="caption" color="text.secondary">
                  GTIN {article.gtin}
                </Typography>
              )}
            </Stack>
            {article.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {article.description}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          {stat('PV TTC', fmt(article.salePriceTtc))}
          {stat('PNET HT', fmt(unitCost))}
          {stat('Marge HT', fmt(marginHt))}
          {stat('Coef', coefficient != null ? `×${coefficient.toFixed(2)}` : '—')}
        </Stack>

        <Divider />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          <Button variant="outlined" startIcon={<EditIcon />} onClick={onEdit}>
            Modifier
          </Button>
          {article.type === 'FABRIQUE' && (
            <Button variant="outlined" startIcon={<PlaylistAddCheckIcon />} onClick={onRecipe}>
              Recette
            </Button>
          )}
          {article.type === 'FABRIQUE' && (
            <Button
              variant="outlined"
              startIcon={pdfBusy === 'cost' ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
              onClick={() => void exportRecipePdf('cost')}
              disabled={pdfBusy != null}
            >
              Fiche coût (PDF)
            </Button>
          )}
          {article.type === 'FABRIQUE' && (
            <Button
              variant="outlined"
              startIcon={pdfBusy === 'prep' ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
              onClick={() => void exportRecipePdf('prep')}
              disabled={pdfBusy != null}
            >
              Fiche prépa (PDF)
            </Button>
          )}
          {article.type === 'MENU' && (
            <Button variant="outlined" startIcon={<RestaurantMenuIcon />} onClick={onMenu}>
              Composition du menu
            </Button>
          )}
          <Button variant="outlined" startIcon={<CalculateIcon />} onClick={onCalc}>
            Calculateur de prix
          </Button>
          <Button
            variant="outlined"
            startIcon={genBusy ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
            onClick={onGeneratePhoto}
            disabled={genBusy}
          >
            {genBusy ? 'Génération…' : 'Générer photo IA'}
          </Button>
          <Button variant="outlined" startIcon={<CampaignIcon />} onClick={onPub}>
            Communiquer
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>
            Supprimer
          </Button>
        </Box>

        {pdfError && (
          <Typography variant="body2" color="error">
            {pdfError}
          </Typography>
        )}
      </Stack>

      <PdfViewerModal
        open={pdf != null}
        onClose={() => setPdf(null)}
        blob={pdf?.blob ?? null}
        filename={pdf?.name ?? 'document.pdf'}
        title={pdf?.title}
      />

      {/* Photo en plein écran : clic n'importe où pour fermer. */}
      {article.photoFile && (
        <Backdrop
          open={photoFull}
          onClick={() => setPhotoFull(false)}
          sx={{ zIndex: (t) => t.zIndex.modal + 1, bgcolor: 'rgba(0,0,0,0.92)', p: 2, cursor: 'zoom-out' }}
        >
          <Box
            component="img"
            src={photoUrl(article.photoFile) ?? undefined}
            alt={article.name}
            sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 1 }}
          />
        </Backdrop>
      )}
    </Modal>
  )
}
