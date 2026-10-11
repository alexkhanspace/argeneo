import { IconButton, InputAdornment, TextField, type SxProps, type Theme } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'

/** Champ de recherche (loupe + effacer) pour filtrer une liste côté client. */
export function SearchField({
  value,
  onChange,
  placeholder = 'Rechercher…',
  sx,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  sx?: SxProps<Theme>
}) {
  return (
    <TextField
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      sx={sx}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Effacer" onClick={() => onChange('')}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  )
}
