import { Box, type SxProps, type Theme } from '@mui/material'

/**
 * Logo Argéneo — marque « A toit d'atelier » (SVG vectoriel) + logotype « Argéneo »
 * avec le « é » en accent. Le texte utilise Bricolage Grotesque (chargé via CDN),
 * rendu inline pour bénéficier de la vraie police (≠ <img>, qui l'ignorerait).
 */
export function BrandLogo({
  height = 40,
  wordmark = true,
  sx,
}: {
  height?: number
  /** Affiche le logotype « Argéneo » à droite de la marque (sinon, marque seule). */
  wordmark?: boolean
  sx?: SxProps<Theme>
}) {
  return (
    <Box
      sx={[
        { display: 'inline-flex', alignItems: 'center', gap: `${height * 0.28}px` },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        component="svg"
        viewBox="0 0 256 256"
        aria-label="Argéneo"
        sx={{ height, width: height, display: 'block', flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="argLogoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ea580c" />
            <stop offset="1" stopColor="#c2410c" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="256" height="256" rx="56" fill="url(#argLogoGrad)" />
        <path
          d="M76 188 L128 64 L180 188"
          fill="none"
          stroke="#ffffff"
          strokeWidth="24"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path d="M96 150 L160 150" fill="none" stroke="#ffffff" strokeWidth="22" strokeLinecap="round" />
      </Box>
      {wordmark && (
        <Box
          component="span"
          sx={{
            fontFamily: "'Bricolage Grotesque', 'Inter', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: height * 0.62,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            color: 'text.primary',
            userSelect: 'none',
          }}
        >
          Arg<Box component="span" sx={{ color: 'primary.main' }}>é</Box>neo
        </Box>
      )}
    </Box>
  )
}
