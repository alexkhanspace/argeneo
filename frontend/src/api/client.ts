import axios from 'axios'

const TOKEN_KEY = 'argeneo.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const api = axios.create({ baseURL: '/api' })

// Injecte le JWT sur chaque requête.
api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Session expirée / token invalide (401) : on nettoie et on renvoie au login,
// au lieu de laisser remonter un « Request failed with status code 401 » brut.
// Exceptions : l'appel de login lui-même (mauvais identifiants → message en place)
// et si on est déjà sur /login (évite une boucle de redirection).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url: string = error?.config?.url ?? ''
    const onLogin = window.location.pathname.startsWith('/login')
    if (status === 401 && !url.includes('/auth/login') && !onLogin) {
      tokenStore.clear()
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

/** Extrait un message d'erreur lisible d'une erreur axios. */
export function errorMessage(error: unknown, fallback = 'Une erreur est survenue'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    return data?.message ?? error.message ?? fallback
  }
  return fallback
}
