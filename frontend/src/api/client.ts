import axios from 'axios'

const TOKEN_KEY = 'argeneo.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/**
 * Vrai si le JWT stocké est absent ou expiré (champ `exp`, en secondes).
 * Sert à distinguer une VRAIE fin de session (→ retour login) d'un 401 ponctuel
 * renvoyé par un endpoint alors que le jeton est encore valide (→ on ne déconnecte pas,
 * pour ne pas perdre le travail en cours, ex. une affiche).
 */
function tokenExpired(): boolean {
  const token = tokenStore.get()
  if (!token) return true
  try {
    let b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4) // padding base64url
    const payload = JSON.parse(atob(b64))
    if (typeof payload.exp !== 'number') return false
    return Date.now() >= payload.exp * 1000
  } catch {
    return true // jeton illisible : on le considère invalide
  }
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

// 401 : on ne renvoie au login QUE si la session est réellement finie (jeton absent/expiré).
// Un 401 ponctuel d'un endpoint alors que le jeton est encore valide (ex. appel IA lourd)
// ne doit PAS déconnecter l'utilisateur ni lui faire perdre son travail — on laisse alors
// l'erreur remonter pour être affichée en place.
// Exceptions : l'appel de login lui-même (mauvais identifiants → message en place)
// et si on est déjà sur /login (évite une boucle de redirection).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const url: string = error?.config?.url ?? ''
    const onLogin = window.location.pathname.startsWith('/login')
    // Corps d'erreur en Blob (réponses responseType:'blob', ex. génération d'image IA) : on le
    // relit en JSON pour qu'errorMessage puisse afficher le message clair du serveur au lieu d'un
    // « Request failed with status code 502 » opaque.
    const data = error?.response?.data
    if (data instanceof Blob) {
      try {
        const text = await data.text()
        error.response.data = text ? JSON.parse(text) : undefined
      } catch {
        // corps non-JSON : on laisse tel quel
      }
    }
    if (status === 401 && !url.includes('/auth/login') && !onLogin && tokenExpired()) {
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
