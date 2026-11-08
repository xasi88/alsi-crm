// Работа без связи: приложение открывается из копии на телефоне.
// Данные хранит сама база Firebase на телефоне, здесь только файлы приложения.
// Хранилище копий общее у всех приложений на xasi88.github.io: удаляем только свои (имя с alsi-crm-).
const CACHE = 'alsi-crm-1';
const OWN = self.registration.scope;
const CDN = ['https://www.gstatic.com/firebasejs/', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];
const mine = (u) => u.startsWith(OWN);
const cdn = (u) => CDN.some((p) => u.startsWith(p));

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html'])).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('alsi-crm-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Свои файлы: сначала сеть (без старой копии браузера), без связи: копия
async function netFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
    if (res.ok) c.put(req.url, res.clone());
    return res;
  } catch (e) {
    const hit = (await c.match(req.url)) || (await c.match(req.url, { ignoreSearch: true }));
    if (hit) return hit;
    if (req.mode === 'navigate') return (await c.match('./')) || (await c.match('index.html', { ignoreSearch: true })) || Response.error();
    return Response.error();
  }
}

// Библиотеки и шрифты: адрес с номером версии не меняется, берём из копии
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req.url);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req.url, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  if (mine(r.url)) e.respondWith(netFirst(r));
  else if (cdn(r.url)) e.respondWith(cacheFirst(r));
});

// Приложение присылает адреса своих файлов после загрузки: так копия есть с первого входа
self.addEventListener('message', (e) => {
  const list = (e.data && e.data.cache) || [];
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(list.filter((u) => mine(u) || cdn(u)).map((u) =>
    c.match(u).then((hit) => hit || fetch(u, { cache: 'no-cache' }).then((res) => res.ok && c.put(u, res))).catch(() => {})))));
});
