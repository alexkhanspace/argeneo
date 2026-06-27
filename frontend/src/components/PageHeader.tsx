import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  /** Action principale (ex. bouton « Nouveau … »), alignée à droite. */
  action?: ReactNode
}

/** En-tête de page standard : titre + sous-titre optionnel + action à droite. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        mb: 3,
      }}
    >
      <Box>
        <Typography variant="h1" gutterBottom>
          {title}
        </Typography>
        {subtitle != null && (
          <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  )
}
