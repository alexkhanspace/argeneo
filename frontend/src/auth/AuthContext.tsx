import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { tokenStore } from '../api/client'
import { fetchMe, login as apiLogin } from '../api/iam'
import type { Me } from '../api/types'

interface AuthState {
  me: Me | null
  loading: boolean
  login: (email: string, password: string) => Promise<Me>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  // Au montage : si un token est stocké, on récupère le profil.
  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false)
      return
    }
    fetchMe()
      .then(setMe)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const response = await apiLogin(email, password)
    tokenStore.set(response.token)
    const profile = await fetchMe()
    setMe(profile)
    return profile
  }

  const logout = () => {
    tokenStore.clear()
    setMe(null)
  }

  return (
    <AuthContext.Provider value={{ me, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider')
  }
  return ctx
}
