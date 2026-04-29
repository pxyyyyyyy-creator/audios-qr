const CACHE_NAME = 'audio-qr-v6';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/qrcode.min.js',
    '/icon-192.png',
    '/icon-512.png'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Ignorar favicon
    if (url.pathname === '/favicon.ico') {
        event.respondWith(new Response('', { status: 204 }));
        return;
    }

    // SHARE TARGET - intercepta POST em /share-target
    if (event.request.method === 'POST' && url.pathname === '/share-target') {
        event.respondWith(handleShareTarget(event));
        return;
    }

    // Ignorar outros POSTs (API calls etc)
    if (event.request.method !== 'GET') {
        return;
    }

    // Network-first para GET
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request).then(cached => {
                return cached || new Response('Sem conexão', { status: 503 });
            });
        })
    );
});

async function handleShareTarget(event) {
    try {
        const formData = await event.request.formData();
        const audioFile = formData.get('audio');

        if (audioFile && audioFile.size > 0) {
            await storeSharedFile(audioFile);
            return Response.redirect('/?shared=1', 303);
        }
    } catch (err) {
        console.error('Share target error:', err);
    }
    return Response.redirect('/', 303);
}

function storeSharedFile(file) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AudioQRDB', 1);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('sharedFiles')) {
                db.createObjectStore('sharedFiles', { keyPath: 'id' });
            }
        };

        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction('sharedFiles', 'readwrite');
            const store = transaction.objectStore('sharedFiles');
            store.put({ id: 'latest', file, name: file.name, timestamp: Date.now() });
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
        };

        request.onerror = reject;
    });
}
