import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Slider,
  Stack,
  Typography,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { errorMessage } from '../api/client'
import { getPricingAdvice } from '../api/insights'
import { listMyEtablissements } from '../api/daily'
import { Modal } from './Modal'

interface PriceCalculatorProps {
  open: boolean
  onClose: () => void
  /** Coût de revient unitaire HT (PNET). */
  cost: number | null
  /** Taux de TVA (ex. 0.055). */
  vatRate: number
  articleName: string
  articleType?: string | null
  articleDescription?: string | null
  /** Applique le prix choisi (TTC) dans le formulaire appelant. */
  onApply: (priceTtc: number) => void
}

const fmt = (v: number | null): string =>
  v == null ? '—' : v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Quelques prix « psychologiques » (terminaisons .50/.90/.95/.99) au‑dessus de la cible. */
function psychoPrices(target: number): number[] {
  const endings = [0.5, 0.9, 0.95, 0.99]
  const base = Math.floor(target)
  const out = new Set<number>()
  for (let k = 0; k <= 2; k++) {
    for (const e of endings) {
      const v = Number((base + k + e).toFixed(2))
      if (v >= target - 0.01) out.add(v)
    }
  }
  return [...out].sort((a, b) => a - b).slice(0, 4)
}

export function PriceCalculator({
  open,
  onClose,
  cost,
  vatRate,
  articleName,
  articleType,
  articleDescription,
  onApply,
}: PriceCalculatorProps) {
  const [coef, setCoef] = useState(3)
  const [chosen, setChosen] = useState<number | null>(null)
  const [advice, setAdvice] = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pvHt = cost != null ? cost * coef : null
  const pvTtc = pvHt != null ? pvHt * (1 + vatRate) : null
  const suggestions = pvTtc != null ? psychoPrices(pvTtc) : []
  const applied = chosen ?? (pvTtc != null ? Number(pvTtc.toFixed(2)) : null)

  const askAdvice = async () => {
    setError(null)
    setAdviceLoading(true)
    try {
      const etabs = await listMyEtablissements().catch(() => [])
      const e = etabs[0]
      const res = await getPricingAdvice({
        etablissement: e?.name ?? 'établissement',
        description: e?.description ?? null,
        location: e?.address ?? null,
        articleName,
        articleType,
        articleDescription,
        pnetHt: cost,
        vatRate,
        // On n'envoie PAS le prix du curseur : l'IA propose un prix indépendant.
        priceTtc: null,
      })
      setAdvice(res.enabled ? res.advice : 'Analyse IA non configurée sur ce serveur.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setAdviceLoading(false)
    }
  }

  // Extrait le prix conseillé par l'IA (« Prix conseillé : X,XX € ») pour pouvoir l'appliquer.
  const aiPrice = (() => {
    const m = advice.match(/(\d+[.,]\d{1,2})/)
    if (!m) return null
    const v = Number(m[1].replace(',', '.'))
    return Number.isFinite(v) && v > 0 ? v : null
  })()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <>
          Calculateur <Box component="span" sx={{ textTransform: 'none' }}>de</Box> prix
        </>
      }
    >
      <Stack spacing={2} sx={{ mt: 1 }}>
        {cost == null ? (
          <Alert severity="info">
            Coût de revient (PNET) inconnu — renseigne d'abord la recette ou le prix d'achat de l'article.
          </Alert>
        ) : (
          <>
            <Typography variant="body2">
              Coût de revient (PNET HT) : <strong>{fmt(cost)} €</strong>
            </Typography>

            <Box>
              <Typography variant="body2" gutterBottom>
                Coefficient de marge : <strong>×{coef.toFixed(1)}</strong>
              </Typography>
              <Slider
                value={coef}
                onChange={(_, v) => {
                  setCoef(v as number)
                  setChosen(null)
                }}
                min={1.5}
                max={5}
                step={0.1}
                marks={[
                  { value: 2.5, label: '2,5' },
                  { value: 3, label: '3' },
                  { value: 3.5, label: '3,5' },
                  { value: 4, label: '4' },
                ]}
              />
            </Box>

            <Typography variant="body2">
              PV HT : {fmt(pvHt)} € → <strong>PV TTC : {fmt(pvTtc)} €</strong> (TVA {Math.round(vatRate * 100)} %)
            </Typography>

            <Box>
              <Typography variant="body2" gutterBottom>
                Prix psychologiques conseillés :
              </Typography>
              <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                {suggestions.map((s) => (
                  <Chip
                    key={s}
                    label={`${fmt(s)} €`}
                    color={applied === s ? 'primary' : 'default'}
                    variant={applied === s ? 'filled' : 'outlined'}
                    onClick={() => setChosen(s)}
                  />
                ))}
              </Stack>
            </Box>

            <Box>
              <Button
                size="small"
                startIcon={adviceLoading ? <CircularProgress size={14} /> : <AutoAwesomeIcon fontSize="small" />}
                onClick={askAdvice}
                disabled={adviceLoading}
              >
                Prix conseillé par l'IA
              </Button>
              {advice && (
                <Typography
                  variant="body2"
                  sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, whiteSpace: 'pre-line' }}
                >
                  {advice}
                </Typography>
              )}
              {aiPrice != null && (
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ mt: 1 }}
                  onClick={() => {
                    onApply(aiPrice)
                    onClose()
                  }}
                >
                  Appliquer {fmt(aiPrice)} €
                </Button>
              )}
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Button
              variant="contained"
              disabled={applied == null}
              onClick={() => {
                if (applied != null) {
                  onApply(applied)
                  onClose()
                }
              }}
            >
              Appliquer {applied != null ? `${fmt(applied)} €` : ''}
            </Button>
          </>
        )}
      </Stack>
    </Modal>
  )
}
