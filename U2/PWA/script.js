//nombre de la cache
const CACHE_NAME = 'Media-PWA-v2';

//archivos que se almacerean en cache
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './script.js',
    './manifest.webmanifest',
    './favicon.png',
    './icons/apple-touch-icon-180.png',
    './icons/icon-192.png',
    './icons/icon-256.png',
    './icons/icon-384.png',
    './icons/icon-512.png',
    './icons/maskable-192.png',
    './icons/maskable-512.png',
    './assets/old_phone_ring.mp3',
    './assets/old_phone_ring.ogg'
];

//evento que se ejecuta cuando el SW se instala por primera vez
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
    );
});

//evento que se ejecuta cuando el SW se activa
self.addEventListener('activate', (e) => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        );
        self.clients.claim();
    })());
});

//evento que intercepta todas las peticiones de la aplicacion
self.addEventListener('fetch', (e) => {
    const req = e.request;
    e.respondWith((async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
            const fresh = await fetch(req);
            const cache = await caches.open(CACHE_NAME);
            if (req.method === 'GET' && fresh.status === 200) {
                cache.put(req, fresh.clone());
            }
            return fresh;
        } catch (err) {
            return cached || Response.error();
        }
    })());
});
