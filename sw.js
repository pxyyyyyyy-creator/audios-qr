const CACHE_NAME = 'audio-qr-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Skip caching for favicon and other non-essential requests
    if (url.pathname.endsWith('/favicon.ico')) {
        event.respondWith(fetch(event.request).catch(() => new Response('', {status: 404})));
        return;
    }
    
    if (event.request.method === 'POST' && url.pathname.endsWith('index.html')) {
        event.respondWith(handleShareTarget(event));
        return;
    }
    
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).catch(() => {
                return new Response('Network error', {status: 503});
            });
        })
    );
});

async function handleShareTarget(event) {
    try {
        const formData = await event.request.formData();
        const audioFile = formData.get('audio');
        
        if (audioFile && audioFile.type.includes('audio/')) {
            await storeSharedFile(audioFile);
            return Response.redirect('./index.html?shared=1', 303);
        }
    } catch (err) {
        console.error('Error handling share:', err);
    }
    return fetch(event.request);
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
