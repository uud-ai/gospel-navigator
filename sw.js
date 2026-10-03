// sw.js — офлайн-кэш для «Благовеста».
//
// Файл должен лежать В ТОЙ ЖЕ папке, что index.html — scope service worker'а
// браузер берёт из места самого файла (см. регистрацию в index.html:
// navigator.serviceWorker.register('sw.js'), путь относительный специально,
// чтобы работало и в корне (GitHub Pages gospel-navigator), и в подкаталоге
// (nikolskiyhram.site/blagovest/) без хардкода.
//
// Что кэшируется:
//  - оболочка приложения (APP_SHELL) — ставится в кэш при install, поэтому
//    темы и «стих дня» (это статика, зашитая в topics.js/verses_of_day.js)
//    открываются офлайн сразу после первого визита;
//  - внешние CDN (шрифты, иконки Tabler, marked, DOMPurify, Telegram SDK) —
//    кэшируются по факту первого успешного запроса (runtime cache): заранее
//    их не перечисляем, шрифтовых файлов десятки и у них версионированные
//    имена на стороне CDN.
//
// Чего не кэшируется:
//  - POST-запросы к чат-бэкенду (Cloudflare Workers) — это живой API,
//    не статика. Офлайн чат закономерно не отвечает — index.html уже
//    показывает понятную ошибку сети (см. postChatRequest).
//
// При выпуске новой версии index.html/topics.js/verses_of_day.js —
// поменяй CACHE_NAME, иначе старый кэш переживёт деплой.
const CACHE_NAME = 'blagovest-v1';
const APP_SHELL = ['./', './index.html', './topics.js', './verses_of_day.js'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return; // POST к чат-бэкенду не трогаем — пропускаем сети напрямую

    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req).then((res) => {
                // <link>/<script> на внешние CDN в index.html — без crossorigin,
                // поэтому для браузера это no-cors-запрос: ответ приходит opaque
                // (status 0, ok всегда false, тело не инспектируется). Это не
                // ошибка — кэшируем его как есть, иначе не доедут ни иконки
                // Tabler, ни marked/DOMPurify, только файлы шрифтов (шрифты
                // браузер грузит через CORS по спеке независимо от атрибута).
                if (res.ok || res.type === 'opaque') {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                }
                return res;
            });
        })
    );
});
