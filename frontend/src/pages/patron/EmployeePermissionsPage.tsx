import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { errorMessage } from '../../api/client'
import {
  assignPermissions,
  getUserPermissions,
  listEtablissements,
  listPermissions,
  listPresets,
} from '../../api/iam'
import type { Etablissement, Permission, Preset, UserPermissions } from '../../api/types'
import { PageHeader } from '../../components/PageHeader'

export function EmployeePermissionsPage() {
  const { id } = useParams()
  const userId = Number(id)

  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [userPerms, setUserPerms] = useState<UserPermissions | null>(null)

  const [selected, setSelected] = useState<number | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Chargement initial.
  useEffect(() => {
    Promise.all([listEtablissements(), listPermissions(), listPresets(), getUserPermissions(userId)])
      .then(([b, p, pr, up]) => {
        setEtablissements(b)
        setPermissions(p)
        setPresets(pr)
        setUserPerms(up)
        if (b.length > 0) setSelected(b[0].id)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [userId])

  // À chaque changement de etablissement sélectionnée, on recharge les droits courants.
  useEffect(() => {
    if (selected == null || !userPerms) return
    const current = userPerms.etablissements.find((x) => x.etablissementId === selected)
    setChecked(new Set(current?.permissionCodes ?? []))
    setSaved(false)
  }, [selected, userPerms])

  const byCategory = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const perm of permissions) {
      const list = map.get(perm.category) ?? []
      list.push(perm)
      map.set(perm.category, list)
    }
    return [...map.entries()]
  }, [permissions])

  const toggle = (code: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
    setSaved(false)
  }

  const applyPreset = (preset: Preset) => {
    setChecked(new Set(preset.permissionCodes))
    setSaved(false)
  }

  const save = async () => {
    if (selected == null) return
    setError(null)
    setBusy(true)
    try {
      await assignPermissions(userId, selected, [...checked])
      const refreshed = await getUserPermissions(userId)
      setUserPerms(refreshed)
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (etablissements.length === 0) {
    return (
      <>
        <PageHeader title="Permissions" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={`Permissions de l'employé #${userId}`}
      />

      <Tabs
        value={selected ?? false}
        onChange={(_, value) => setSelected(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2 }}
      >
        {etablissements.map((b) => (
          <Tab key={b.id} value={b.id} label={b.name} />
        ))}
      </Tabs>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction="row"
            sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 3 }}
          >
            <Typography variant="body2" color="text.secondary">
              Presets :
            </Typography>
            {presets.map((preset) => (
              <Button
                key={preset.code}
                variant="outlined"
                size="small"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
            <Button variant="outlined" size="small" onClick={() => setChecked(new Set())}>
              Tout décocher
            </Button>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 3,
            }}
          >
            {byCategory.map(([category, perms]) => (
              <Box key={category}>
                <Typography variant="h3" gutterBottom>
                  {category}
                </Typography>
                <Stack>
                  {perms.map((perm) => (
                    <FormControlLabel
                      key={perm.code}
                      control={
                        <Checkbox
                          checked={checked.has(perm.code)}
                          onChange={() => toggle(perm.code)}
                        />
                      }
                      label={perm.label}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2, mt: 2 }}>{error}</Alert>}
          {saved && <Alert severity="success" sx={{ mb: 2, mt: 2 }}>Permissions enregistrées.</Alert>}

          <Button
            variant="contained"
            onClick={save}
            disabled={busy}
            sx={{ mt: 3, width: { xs: '100%', sm: 'auto' } }}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
