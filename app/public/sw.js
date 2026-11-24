// 情侣小站 PWA：页面壳联网优先（发版即生效），哈希资源缓存优先，API 一律走网络
// 版本号由 vite.config.ts 在构建时注入（package.json version + 构建时间戳），不要手改
const V = '__SW_VERSION__';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png'];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c => c.addAll(SHELL)).catch(() => {})   // 单个资源 404 不阻断安装
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/api/')) return;
  if (u.pathname.startsWith('/pb_files')) return;
  if (u.pathname === '/' || u.pathname.endsWith('.html')) {     // HTML 联网优先，回退缓存壳
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put('/', cp)) }
      return res;
    }).catch(() => caches.match('/') || caches.match('/index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res.ok && u.pathname.startsWith('/assets/')) caches.open(V).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
