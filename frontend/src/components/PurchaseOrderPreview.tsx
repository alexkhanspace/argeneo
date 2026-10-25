import { Box, Stack, Typography } from '@mui/material'
import type { PoPdfData } from '../pdf/PurchaseOrderPdf'

const fmtDate = (iso: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR') : '—')
const fmtQty = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 3 })

/**
 * Aperçu HTML du bon de commande, à la largeur de l'écran. Utilisé sur mobile, où un PDF dans
 * une iframe déborde (iOS l'affiche en taille A4) ou ne s'affiche pas (Android).
 */
export function PurchaseOrderPreview({ data }: { data: Omit<PoPdfData, 'logoUrl'> }) {
  const color = /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : '#1f4e79'
  return (
    <Box sx={{ bgcolor: '#fff', color: '#222', minHeight: '100%' }}>
      <Box sx={{ bgcolor: color, color: '#fff', px: 2, py: 1.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2, textTransform: 'uppercase' }}>
          {data.title}
        </Typography>
        {data.supplierName && <Typography sx={{ fontSize: 13, opacity: 0.9 }}>Fournisseur : {data.supplierName}</Typography>}
      </Box>

      <Box sx={{ px: 2, py: 1.25, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, fontSize: 13 }}>
        <span>
          <Box component="span" sx={{ color: '#777' }}>Lieu : </Box>
          <b>{data.etablissementName ?? '—'}</b>
        </span>
        <span>
          <Box component="span" sx={{ color: '#777' }}>Date : </Box>
          <b>{fmtDate(data.orderDate)}</b>
        </span>
        <span>
          <Box component="span" sx={{ color: '#777' }}>Livraison : </Box>
          <b>{fmtDate(data.deliveryDate)}</b>
        </span>
        {data.createdByName && (
          <span>
            <Box component="span" sx={{ color: '#777' }}>Par : </Box>
            <b>{data.createdByName}</b>
          </span>
        )}
      </Box>

      <Stack
        direction="row"
        sx={{ px: 2, py: 0.75, bgcolor: '#e8edf3', borderBottom: `2px solid ${color}`, fontWeight: 700, fontSize: 13 }}
      >
        <Box sx={{ flex: 1 }}>Désignation</Box>
        <Box sx={{ width: 64, textAlign: 'center' }}>Qté</Box>
      </Stack>
      {data.lines.map((l, i) => (
        <Stack
          key={i}
          direction="row"
          sx={{
            px: 2,
            py: 1,
            alignItems: 'center',
            borderBottom: '1px solid #eee',
            bgcolor: i % 2 === 1 ? '#f7f8fa' : undefined,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
              {l.designation}
            </Typography>
            {(l.code || l.packaging) && (
              <Typography sx={{ fontSize: 12.5, color: '#666' }}>
                {[l.code, l.packaging].filter(Boolean).join(' · ')}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 64,
              flexShrink: 0,
              textAlign: 'center',
              fontWeight: 800,
              fontSize: 17,
              bgcolor: '#fff8e1',
              borderRadius: 1,
              py: 0.5,
            }}
          >
            {l.quantity != null ? fmtQty(l.quantity) : ''}
          </Box>
        </Stack>
      ))}

      {data.notes && (
        <Box sx={{ m: 2, p: 1.25, border: '1px solid #ddd', borderRadius: 1, fontSize: 14 }}>
          <Box sx={{ color: '#777', fontSize: 12 }}>Remarques</Box>
          {data.notes}
        </Box>
      )}
      <Typography sx={{ px: 2, py: 1.5, fontSize: 13, color: '#555' }}>
        {data.lines.length} produit(s) commandé(s)
      </Typography>
    </Box>
  )
}
