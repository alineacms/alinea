// Keeps files uploaded in the /demo dashboard in this browser and serves them
// back at their media url, so uploads work without a backend.
const cacheName = 'alinea-demo-uploads'
const uploadPath = '/demo/__upload'

function cacheKey(name) {
  return new Request(new URL(`/__demo-upload/${name}`, self.location.origin))
}

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  const {request} = event
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.method === 'POST' && url.pathname === uploadPath) {
    event.respondWith(store(request, url.searchParams.get('name')))
    return
  }
  if (request.method !== 'GET' || request.destination !== 'image') return
  const name = decodeURIComponent(url.pathname.split('/').pop() || '')
  if (!name) return
  event.respondWith(
    caches
      .open(cacheName)
      .then(cache => cache.match(cacheKey(name)))
      .then(stored => stored || fetch(request))
  )
})

async function store(request, name) {
  if (!name) return new Response('Missing name', {status: 400})
  const body = await request.blob()
  const cache = await caches.open(cacheName)
  await cache.put(
    cacheKey(name),
    new Response(body, {
      headers: {
        'content-type':
          request.headers.get('content-type') || 'application/octet-stream'
      }
    })
  )
  return new Response(null, {status: 204})
}
