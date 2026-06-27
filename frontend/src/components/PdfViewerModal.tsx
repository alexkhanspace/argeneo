import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { theme } from '../theme'

/**
 * Aperçu d'un PDF (blob) dans une popup, avec téléchargement et ouverture.
 * Le téléchargement direct (`<a download>`) échoue souvent en PWA/iOS : l'aperçu
 * + bouton « Ouvrir » permet toujours de récupérer le document.
 */
export function PdfViewerModal({
  open,
  onClose,
  blob,
  filename,
  title = 'Document PDF',
}: {
  open: boolean
  onClose: () => void
  blob: Blob | null
  filename: string
  title?: string
}) {
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  const download = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle component="div" sx={{ pr: 7 }}>
        <Typography variant="h6" component="span">
          {title}
        </Typography>
        <IconButton
          aria-label="Fermer"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, height: fullScreen ? 'auto' : '72vh' }}>
        {url ? (
          <Box
            component="iframe"
            src={url}
            title={title}
            sx={{ width: '100%', height: fullScreen ? '70vh' : '100%', border: 0, display: 'block' }}
          />
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">Préparation du PDF…</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            startIcon={<OpenInNewIcon />}
            onClick={() => url && window.open(url, '_blank')}
            disabled={!url}
          >
            Ouvrir
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={download} disabled={!url}>
            Télécharger
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
