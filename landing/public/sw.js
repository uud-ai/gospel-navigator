// Прежняя версия приложения жила в корне домена и регистрировала здесь
// service worker с кэшем оболочки. Теперь в корне лендинг, а приложение
// переехало в /app/. Этот файл заменяет старый sw.js: при обновлении у
// вернувшихся пользователей он чистит кэши, снимает регистрацию и
// перезагружает открытые вкладки, чтобы они увидели актуальный сайт.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
