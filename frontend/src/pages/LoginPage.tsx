import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
    <div className="center">
      <form className="card login" onSubmit={onSubmit}>
        <img src="/argeneo-logo.png" className="login-logo" alt="Argéneo" />
        <p className="muted">Connectez-vous à votre back-office.</p>

        <label>
          E-mail
          <input
            type="email"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <div className="alert">{error}</div>}

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
