import { Box, Stack, Typography } from '@mui/material'
import type { LabelBadge } from '../api/labels'

const CHALK_CSS = '"Permanent Marker", "Bricolage Grotesque", cursive'

export interface LabelPreviewStyle {
  brand: string
  bgColor: string
  textColor: string
  borderColor: string
  widthCm: number
  heightCm: number
  fontScale: number
  showPrice: boolean
  frame: 'none' | 'wood'
  chalk: boolean
  badgePos: 'tr' | 'tl' | 'footer'
  badgeScale: number
}

/**
 * Aperçu live d'une étiquette, fidèle au rendu PDF (mêmes ratios en cqw, overflow masqué).
 * Partagé entre l'éditeur de modèles et l'écran d'impression.
 */
export function LabelPreview({
  style,
  badges,
  name,
  price,
  note,
  logoSrc,
  maxWidth = 360,
}: {
  style: LabelPreviewStyle
  badges: LabelBadge[]
  name: string
  price: string | null
  note: string | null
  logoSrc: string | null
  maxWidth?: number
}) {
  const { bgColor, textColor, borderColor, frame, chalk, fontScale, badgePos, badgeScale, showPrice, brand } = style
  const wNum = Math.max(2, Math.min(20, style.widthCm || 10))
  const hNum = Math.max(2, Math.min(28, style.heightCm || 6))
  const shown = badges.filter((b) => b.img || b.text?.trim())

  const renderBadge = (b: LabelBadge, i: number, footer: boolean) =>
    b.img ? (
      <Box
        key={i}
        component="img"
        src={b.img}
        alt=""
        style={
          footer
            ? { height: `${(12 * badgeScale).toFixed(1)}cqw`, objectFit: 'contain' }
            : { width: `${(22 * badgeScale).toFixed(1)}cqw`, objectFit: 'contain' }
        }
      />
    ) : (
      <Box
        key={i}
        sx={{
          bgcolor: b.color ?? textColor,
          color: '#fff',
          borderRadius: 0.5,
          px: 0.5,
          fontWeight: 700,
          textAlign: 'center',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}
        style={{ fontSize: `${((footer ? 2.2 : 2.4) * badgeScale).toFixed(1)}cqw` }}
      >
        {b.text}
      </Box>
    )

  return (
    <Box
      sx={{
        aspectRatio: `${wNum} / ${hNum}`,
        containerType: 'inline-size',
        overflow: 'hidden',
        position: 'relative',
        bgcolor: bgColor,
        color: textColor,
        border: '1px dashed',
        borderColor: borderColor,
        borderRadius: 1,
        p: 0.5,
        mb: 2,
        maxWidth,
        mx: 'auto',
      }}
    >
      {shown.length > 0 && badgePos !== 'footer' && (
        <Box
          sx={{
            position: 'absolute',
            top: frame === 'wood' ? `${(70 / wNum).toFixed(1)}cqw` : `${(40 / wNum).toFixed(1)}cqw`,
            ...(badgePos === 'tl'
              ? { left: frame === 'wood' ? `${(70 / wNum).toFixed(1)}cqw` : `${(40 / wNum).toFixed(1)}cqw` }
              : { right: frame === 'wood' ? `${(70 / wNum).toFixed(1)}cqw` : `${(40 / wNum).toFixed(1)}cqw` }),
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            alignItems: badgePos === 'tl' ? 'flex-start' : 'flex-end',
          }}
        >
          {shown.map((b, i) => renderBadge(b, i, false))}
        </Box>
      )}
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          p: frame === 'wood' ? 1.25 : 1,
          border: frame === 'wood' ? '5px solid #6b4423' : 'none',
          outline: frame === 'wood' ? '1px solid #caa06a' : 'none',
          outlineOffset: frame === 'wood' ? '-6px' : 0,
        }}
      >
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <Box sx={{ textAlign: 'center', minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: chalk ? CHALK_CSS : undefined,
                fontWeight: chalk ? 400 : 800,
                textTransform: 'uppercase',
                lineHeight: 1.15,
                whiteSpace: 'pre-line',
              }}
              style={{ fontSize: `${(7.06 * fontScale).toFixed(2)}cqw` }}
            >
              {name}
            </Typography>
            {note && (
              <Typography
                sx={{ fontFamily: chalk ? CHALK_CSS : undefined, mt: 0.5, opacity: 0.85 }}
                style={{ fontSize: `${(2.96 * fontScale).toFixed(2)}cqw` }}
              >
                {note}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ borderTop: '1px solid', borderColor: textColor, opacity: 0.25, my: 0.75 }} />
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            {logoSrc && (
              <Box component="img" src={logoSrc} alt="" sx={{ height: 16, maxWidth: 56, objectFit: 'contain' }} />
            )}
            <Typography
              sx={{
                fontFamily: chalk ? CHALK_CSS : undefined,
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontWeight: 700,
                opacity: 0.7,
              }}
              style={{ fontSize: `${(28.23 / wNum).toFixed(2)}cqw` }}
              noWrap
            >
              {brand || 'Marque'}
            </Typography>
          </Stack>
          {shown.length > 0 && badgePos === 'footer' && (
            <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center', mx: 0.5 }}>
              {shown.map((b, i) => renderBadge(b, i, true))}
            </Stack>
          )}
          {showPrice && price && (
            <Typography
              sx={{ fontFamily: chalk ? CHALK_CSS : undefined, fontWeight: chalk ? 400 : 700 }}
              style={{ fontSize: `${(5.64 * fontScale).toFixed(2)}cqw` }}
            >
              {price}
            </Typography>
          )}
        </Stack>
      </Box>
    </Box>
  )
}
