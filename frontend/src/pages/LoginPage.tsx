import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import LoginIcon from '@mui/icons-material/Login'
import { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { homePathFor } from '../auth/roles'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const me = await login(email, password)
      navigate(homePathFor(me), { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Identifiants invalides'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 380 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack component="form" spacing={2.5} onSubmit={onSubmit}>
            <Box
              component="img"
              src="/argeneo-logo.png"
              alt="Argéneo"
              sx={{ height: 110, width: 'auto', alignSelf: 'center', display: 'block' }}
            />
            <Typography color="text.secondary" align="center">
              Connectez-vous à votre back-office.
            </Typography>

            <TextField
              label="E-mail"
              type="email"
              value={email}
              autoComplete="username"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Mot de passe"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <Alert severity="error">{error}</Alert>}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
              startIcon={<LoginIcon />}
            >
              {submitting ? 'Connexion…' : 'Se connecter'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
