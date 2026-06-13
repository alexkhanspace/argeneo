// Service worker Argéneo — coquille hors-ligne + passthrough API.
const CACHE = 'argeneo-v1'
const SHELL = ['/', '/index.html', '/argeneo-logo.png', '/manifest.webmanifest']

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

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // L'API n'est jamais mise en cache : toujours le réseau.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return
  }

  // Navigation (HTML) : réseau d'abord, repli sur la coquille en cache.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
    return
  }

  // Assets fingerprintés : cache d'abord.
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)))
})
