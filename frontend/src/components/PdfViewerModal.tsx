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
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ShareIcon from '@mui/icons-material/Share'
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
  copyOnShare,
}: {
  open: boolean
  onClose: () => void
  blob: Blob | null
  filename: string
  title?: string
  /** Texte copié dans le presse-papier au partage (ex. e-mail du fournisseur, à coller en destinataire). */
  copyOnShare?: string | null
}) {
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
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

  // Partage natif (tablette / mobile : e-mail, WhatsApp…) quand le navigateur sait partager un fichier.
  const shareFile = blob ? new File([blob], filename, { type: 'application/pdf' }) : null
  const canShare =
    shareFile != null && typeof navigator.canShare === 'function' && navigator.canShare({ files: [shareFile] })
  // Copie sans attendre la promesse : sur iOS, un await avant navigator.share ferait perdre
  // « l'activation utilisateur » et le partage serait refusé.
  const copy = () => {
    if (!copyOnShare || !navigator.clipboard) return
    navigator.clipboard.writeText(copyOnShare).then(() => setCopied(true)).catch(() => undefined)
  }
  const share = () => {
    if (!shareFile) return
    copy()
    navigator.share({ files: [shareFile], title }).catch(() => undefined) // annulation : rien à faire
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
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {copied && copyOnShare && (
          <Typography variant="body2" color="success.main" sx={{ flex: 1, minWidth: 200 }}>
            E-mail copié : {copyOnShare} — collez-le comme destinataire.
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            startIcon={<OpenInNewIcon />}
            onClick={() => url && window.open(url, '_blank')}
            disabled={!url}
          >
            Ouvrir
          </Button>
          {canShare && (
            <Button startIcon={<ShareIcon />} onClick={share}>
              Partager
            </Button>
          )}
          {!canShare && copyOnShare && (
            <Button startIcon={<ContentCopyIcon />} onClick={copy}>
              Copier l'e-mail
            </Button>
          )}
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={download} disabled={!url}>
            Télécharger
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
