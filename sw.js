const CACHE_NAME = 'audio-qr-v5';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css?v=8',
    './script.js?v=8',
    './manifest.json',
    './qrcode.min.js',
    './icon-192.png',
    './icon-512.png'
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

    if (url.pathname.endsWith('/favicon.ico')) {
        event.respondWith(fetch(event.request).catch(() => new Response('', {status: 404})));
        return;
    }

    if (event.request.method === 'POST' && url.pathname.endsWith('index.html')) {
        event.respondWith(handleShareTarget(event));
        return;
    }

    if (event.request.method === 'POST') {
        return;
    }

    event.respondWith(
        fetch(event.request).then(response => {
            return response;
        }).catch(() => {
            return caches.match(event.request).then(cached => {
                return cached || new Response('Sem conexão', {status: 503});
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
            return Response.redirect('./index.html?shared=1', 303);
        }
    } catch (err) {
        console.error('Erro ao receber compartilhamento:', err);
    }
    return Response.redirect('./index.html', 303);
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
