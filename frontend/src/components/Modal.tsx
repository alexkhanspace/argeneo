import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { theme } from '../theme'

interface ModalProps {
  open: boolean
  title?: ReactNode
  onClose: () => void
  children: ReactNode
}

/**
 * Modale générique adossée à MUI Dialog (overlay, Échap, clic extérieur, croix).
 * Plein écran sur mobile ; croix positionnée proprement en haut à droite.
 * Même signature que l'ancienne version maison — les pages appelantes sont inchangées.
 */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      {/* pr réservé pour la croix afin que le titre ne passe pas dessous. */}
      <DialogTitle component="div" sx={{ pr: 7 }}>
        <Typography variant="h6" component="span" sx={{ textTransform: 'capitalize' }}>
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
      <DialogContent dividers>{children}</DialogContent>
    </Dialog>
  )
}
