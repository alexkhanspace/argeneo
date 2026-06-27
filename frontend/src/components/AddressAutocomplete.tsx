import { useEffect, useMemo, useState } from 'react'
import { Autocomplete, TextField } from '@mui/material'

/** Une suggestion d'adresse normalisée (issue de la Base Adresse Nationale). */
export interface AddressPick {
  label: string
  latitude: number
  longitude: number
}

interface BanFeature {
  properties: { label: string }
  geometry: { coordinates: [number, number] } // [lon, lat]
}

interface AddressAutocompleteProps {
  /** Valeur courante (label d'adresse), ou null. */
  value: string | null
  /** Appelé quand l'utilisateur choisit une suggestion (avec ses coordonnées). */
  onPick: (pick: AddressPick | null) => void
  label?: string
  required?: boolean
}

/**
 * Champ adresse avec autocomplétion via la Base Adresse Nationale
 * (api-adresse.data.gouv.fr — gratuit, sans clé). Choisir une suggestion
 * remonte le label normalisé + latitude/longitude.
 */
export function AddressAutocomplete({ value, onPick, label = 'Adresse', required }: AddressAutocompleteProps) {
  const [input, setInput] = useState(value ?? '')
  const [options, setOptions] = useState<AddressPick[]>([])
  const [loading, setLoading] = useState(false)

  // Garde l'input synchro si la valeur externe change (ex. ouverture d'une modale d'édition).
  useEffect(() => {
    setInput(value ?? '')
  }, [value])

  // Recherche BAN débouncée.
  useEffect(() => {
    const q = input.trim()
    if (q.length < 3) {
      setOptions([])
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5&autocomplete=1`,
        )
        const json = (await res.json()) as { features: BanFeature[] }
        if (cancelled) return
        setOptions(
          json.features.map((f) => ({
            label: f.properties.label,
            longitude: f.geometry.coordinates[0],
            latitude: f.geometry.coordinates[1],
          })),
        )
      } catch {
        if (!cancelled) setOptions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [input])

  const currentOptions = useMemo(() => options, [options])

  return (
    <Autocomplete<AddressPick, false, false, true>
      freeSolo
      filterOptions={(x) => x} // pas de filtrage local : la BAN fait le tri
      options={currentOptions}
      loading={loading}
      inputValue={input}
      getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label)}
      onInputChange={(_e, v) => setInput(v)}
      onChange={(_e, picked) => {
        if (picked && typeof picked !== 'string') onPick(picked)
        else if (picked == null) onPick(null)
      }}
      isOptionEqualToValue={(opt, val) => typeof val !== 'string' && opt.label === val.label}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          placeholder="Saisissez une adresse…"
        />
      )}
    />
  )
}
