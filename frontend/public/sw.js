// Service worker Argéneo — coquille hors-ligne + passthrough API + cible de partage.
const CACHE = 'argeneo-v4'
const SHELL = ['/', '/index.html', '/argeneo-logo.png', '/manifest.webmanifest']
// Clé temporaire où l'on dépose le fichier reçu via le partage système (Android).
const SHARED_FILE_URL = '/__shared-invoice'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Reçoit le fichier partagé (Web Share Target, Android), le stocke et redirige vers la page.
async function handleShare(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (file && file.size > 0) {
      const cache = await caches.open(CACHE)
      await cache.put(
        SHARED_FILE_URL,
        new Response(file, {
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-Filename': encodeURIComponent(file.name || 'facture'),
          },
        }),
      )
    }
  } catch {
    // en cas d'échec on redirige quand même : la page affichera l'absence de fichier
  }
  return Response.redirect('/factures?shared=1', 303)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Cible de partage : POST du système vers /factures avec le fichier en multipart.
  if (request.method === 'POST' && url.origin === self.location.origin && url.pathname === '/factures') {
    event.respondWith(handleShare(request))
    return
  }

  // L'API n'est jamais mise en cache : toujours le réseau.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return
  }

  // Navigation (HTML) : réseau d'abord, repli sur la coquille en cache.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
    return
  }

  // Manifest : réseau d'abord (sinon l'orientation/les icônes restent figées).
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(fetch(request).catch(() => caches.match(request)))
    return
  }

  // Assets fingerprintés : cache d'abord.
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)))
})
