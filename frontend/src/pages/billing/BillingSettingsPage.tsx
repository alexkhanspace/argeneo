import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import UploadIcon from '@mui/icons-material/Upload'
import { errorMessage } from '../../api/client'
import {
  getProfile,
  getSettings,
  logoUrl,
  saveProfile,
  saveSettings,
  uploadBillingLogo,
} from '../../api/billing'
import { PageHeader } from '../../components/PageHeader'

/** États de formulaire : tous les champs en chaîne (coercition à l'enregistrement). */
interface ProfileForm {
  siren: string
  siret: string
  tvaIntra: string
  rcs: string
  ape: string
  legalForm: string
  shareCapital: string
  iban: string
  bic: string
  contactEmail: string
  contactPhone: string
}

interface SettingsForm {
  legalMentions: string
  paymentTermsDays: string
  latePenalty: string
  footer: string
  brandColor1: string
  brandColor2: string
  brandColor3: string
}

const EMPTY_PROFILE: ProfileForm = {
  siren: '',
  siret: '',
  tvaIntra: '',
  rcs: '',
  ape: '',
  legalForm: '',
  shareCapital: '',
  iban: '',
  bic: '',
  contactEmail: '',
  contactPhone: '',
}

const EMPTY_SETTINGS: SettingsForm = {
  legalMentions: '',
  paymentTermsDays: '',
  latePenalty: '',
  footer: '',
  brandColor1: '',
  brandColor2: '',
  brandColor3: '',
}

export function BillingSettingsPage() {
  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE)
  const [settings, setSettings] = useState<SettingsForm>(EMPTY_SETTINGS)
  const [logoFile, setLogoFile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getProfile()
      .then((p) => {
        setLogoFile(p.logoFile)
        setProfile({
          siren: p.siren ?? '',
          siret: p.siret ?? '',
          tvaIntra: p.tvaIntra ?? '',
          rcs: p.rcs ?? '',
          ape: p.ape ?? '',
          legalForm: p.legalForm ?? '',
          shareCapital: p.shareCapital != null ? String(p.shareCapital) : '',
          iban: p.iban ?? '',
          bic: p.bic ?? '',
          contactEmail: p.contactEmail ?? '',
          contactPhone: p.contactPhone ?? '',
        })
      })
      .catch((e) => setError(errorMessage(e)))
    getSettings()
      .then((s) =>
        setSettings({
          legalMentions: s.legalMentions ?? '',
          paymentTermsDays: s.paymentTermsDays != null ? String(s.paymentTermsDays) : '',
          latePenalty: s.latePenalty ?? '',
          footer: s.footer ?? '',
          brandColor1: s.brandColor1 ?? '',
          brandColor2: s.brandColor2 ?? '',
          brandColor3: s.brandColor3 ?? '',
        }),
      )
      .catch((e) => setError(errorMessage(e)))
  }, [])

  const setP = (key: keyof ProfileForm) => (e: { target: { value: string } }) =>
    setProfile((p) => ({ ...p, [key]: e.target.value }))
  const setS = (key: keyof SettingsForm) => (e: { target: { value: string } }) =>
    setSettings((s) => ({ ...s, [key]: e.target.value }))

  const onLogoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const updated = await uploadBillingLogo(file)
      setLogoFile(updated.logoFile)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const onSave = async () => {
    setError(null)
    setBusy(true)
    try {
      await saveProfile({
        siren: profile.siren || null,
        siret: profile.siret || null,
        tvaIntra: profile.tvaIntra || null,
        rcs: profile.rcs || null,
        ape: profile.ape || null,
        legalForm: profile.legalForm || null,
        shareCapital: profile.shareCapital === '' ? null : Number(profile.shareCapital),
        iban: profile.iban || null,
        bic: profile.bic || null,
        contactEmail: profile.contactEmail || null,
        contactPhone: profile.contactPhone || null,
      })
      await saveSettings({
        legalMentions: settings.legalMentions || null,
        brandColor1: settings.brandColor1 || null,
        brandColor2: settings.brandColor2 || null,
        brandColor3: settings.brandColor3 || null,
        paymentTermsDays:
          settings.paymentTermsDays === '' ? null : Number(settings.paymentTermsDays),
        latePenalty: settings.latePenalty || null,
        footer: settings.footer || null,
      })
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Paramètres de facturation"
        action={
          <Button variant="contained" onClick={onSave} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Logo
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
          >
            {logoFile ? (
              <Box
                component="img"
                src={logoUrl(logoFile) ?? undefined}
                alt="Logo de l'émetteur"
                sx={{ height: 80, maxWidth: 240, objectFit: 'contain' }}
              />
            ) : (
              <Typography color="text.secondary" variant="body2">
                Aucun logo
              </Typography>
            )}
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => logoInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Téléversement…' : 'Téléverser un logo'}
            </Button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onLogoSelected}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Émetteur (identité légale)
          </Typography>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="SIREN" value={profile.siren ?? ''} onChange={setP('siren')} fullWidth />
              <TextField label="SIRET" value={profile.siret ?? ''} onChange={setP('siret')} fullWidth />
              <TextField label="TVA intra." value={profile.tvaIntra ?? ''} onChange={setP('tvaIntra')} fullWidth />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="RCS" value={profile.rcs ?? ''} onChange={setP('rcs')} fullWidth />
              <TextField label="Code APE" value={profile.ape ?? ''} onChange={setP('ape')} fullWidth />
              <TextField label="Forme juridique" value={profile.legalForm ?? ''} onChange={setP('legalForm')} fullWidth />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Capital social (€)"
                type="number"
                value={profile.shareCapital ?? ''}
                onChange={setP('shareCapital')}
                slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
                fullWidth
              />
              <TextField label="IBAN" value={profile.iban ?? ''} onChange={setP('iban')} fullWidth />
              <TextField label="BIC" value={profile.bic ?? ''} onChange={setP('bic')} fullWidth />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Email de contact" value={profile.contactEmail ?? ''} onChange={setP('contactEmail')} fullWidth />
              <TextField label="Téléphone de contact" value={profile.contactPhone ?? ''} onChange={setP('contactPhone')} fullWidth />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Couleurs de l'enseigne
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Jusqu'à 3 couleurs pour coloriser vos devis et factures (laisser vide = ocre par défaut).
          </Typography>
          <Stack spacing={1.5}>
            {(
              [
                ['brandColor1', 'Couleur principale'],
                ['brandColor2', 'Couleur secondaire'],
                ['brandColor3', "Couleur d'accent"],
              ] as const
            ).map(([key, label]) => (
              <Stack key={key} direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Box
                  component="input"
                  type="color"
                  value={settings[key] || '#b5651d'}
                  onChange={setS(key)}
                  sx={{
                    width: 44,
                    height: 36,
                    p: 0,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: 'transparent',
                  }}
                />
                <Typography variant="body2" sx={{ minWidth: 140 }}>
                  {label}
                </Typography>
                <TextField
                  size="small"
                  value={settings[key] ?? ''}
                  onChange={setS(key)}
                  placeholder="#RRGGBB"
                  sx={{ maxWidth: 130 }}
                />
                {settings[key] && (
                  <Button size="small" onClick={() => setSettings((s) => ({ ...s, [key]: '' }))}>
                    Retirer
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Mentions & conditions
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Délai de paiement (jours)"
              type="number"
              value={settings.paymentTermsDays ?? ''}
              onChange={setS('paymentTermsDays')}
              slotProps={{ htmlInput: { step: '1', min: '0' } }}
              sx={{ maxWidth: { xs: '100%', sm: 240 } }}
            />
            <TextField
              label="Pénalités de retard"
              value={settings.latePenalty ?? ''}
              onChange={setS('latePenalty')}
              multiline
              minRows={2}
            />
            <TextField
              label="Mentions légales"
              value={settings.legalMentions ?? ''}
              onChange={setS('legalMentions')}
              multiline
              minRows={3}
            />
            <TextField
              label="Pied de page"
              value={settings.footer ?? ''}
              onChange={setS('footer')}
              multiline
              minRows={2}
            />
          </Stack>
        </CardContent>
      </Card>

      <Snackbar
        open={saved}
        autoHideDuration={3000}
        onClose={() => setSaved(false)}
        message="Paramètres enregistrés"
      />
    </>
  )
}
