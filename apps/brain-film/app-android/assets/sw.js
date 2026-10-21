/* 脑洞放映厅 · Service Worker(离线也能玩)
   策略:App 外壳(index/js/css/图标)缓存优先;/api/* 一律走网络(要拿最新数据和 AI 结果) */
const CACHE = 'bhfilm-v7';   /* 资源有更新就 +1,老缓存会自动清掉 */
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css', './js/data.js', './js/game.js', './js/ai.js',
  './icon-192.png', './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;                       /* 作品上传等直接放行 */
  if (url.pathname.startsWith('/api/')) return;                 /* AI / 作品库不缓存 */
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const net = fetch(e.request).then(r => {
        if (r && r.status === 200 && url.origin === location.origin) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
