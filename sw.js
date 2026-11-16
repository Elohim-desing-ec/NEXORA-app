/* NEXORA · trabajador de servicio: permite instalar la app y abrirla sin internet.
   Páginas: primero la red (para tener siempre la última versión) y, sin conexión, la copia guardada.
   Archivos (JS, CSS, imágenes, fuentes): la copia guardada al instante y se actualiza en segundo plano. */
const CACHE = 'nexora-v1'
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './logo.svg', './icono-192.png']))); self.skipWaiting() })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET' || !r.url.startsWith('http')) return
  if (r.mode === 'navigate') {
    // Solo la app se guarda como index.html (las páginas fijas, como privacidad.html, no la reemplazan).
    const app = /\/(index\.html)?$/.test(new URL(r.url).pathname)
    e.respondWith(fetch(r).then((res) => { if (app && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copia)) } return res }).catch(() => (app ? caches.match('./index.html') : caches.match(r))))
    return
  }
  e.respondWith(caches.match(r).then((guardado) => {
    const red = fetch(r).then((res) => { if (res.ok && (res.type === 'basic' || res.type === 'cors')) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(r, copia)) } return res }).catch(() => guardado)
    return guardado || red
  }))
})
