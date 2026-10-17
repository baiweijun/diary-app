const CACHE = 'diary-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './dynamic-manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---------- 在 SW 里读 IndexedDB（与页面同一个库） ---------- */
function idbGet(key){
  return new Promise((res) => {
    const r = indexedDB.open('diaryDB', 1);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      if(!d.objectStoreNames.contains('entries')) d.createObjectStore('entries', { keyPath: 'id' });
      if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
    };
    r.onsuccess = () => {
      const db = r.result;
      try{
        const req = db.transaction('settings','readonly').objectStore('settings').get(key);
        req.onsuccess = () => { res(req.result ? req.result.value : null); db.close(); };
        req.onerror = () => { res(null); db.close(); };
      }catch(err){ res(null); }
    };
    r.onerror = () => res(null);
  });
}

function dataURLToBytes(d){
  const b = atob(d.split(',')[1]), n = b.length, u = new Uint8Array(n);
  for(let i=0;i<n;i++) u[i] = b.charCodeAt(i);
  return u;
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET') return;

  // 动态图标：返回用户自定义的图标 PNG
  if(url.pathname.endsWith('/dynamic-icon.png')){
    e.respondWith(
      idbGet('manifestIconData').then(data => {
        if(data){
          return new Response(dataURLToBytes(data), {
            headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }
          });
        }
        // 没有自定义图标 → 用默认 512 图标
        return fetch(new URL('./icons/icon-512.png', url), { cache: 'no-store' });
      }).catch(() => fetch(new URL('./icons/icon-512.png', url)))
    );
    return;
  }

  // 动态 manifest：返回含自定义名字/图标的 manifest
  if(url.pathname.endsWith('/dynamic-manifest.webmanifest')){
    e.respondWith(
      (async () => {
        const [name, iconData] = await Promise.all([
          idbGet('appName'),
          idbGet('hasCustomIcon') ? idbGet('manifestIconData') : Promise.resolve(null)
        ]);
        const appName = name || '今天写日记了吗';
        const short = appName.length > 8 ? appName.slice(0,8) : appName;
        const iconSrc = new URL('./dynamic-icon.png', url).href;
        const staticIcon = new URL('./icons/icon-512.png', url).href;
        const mani = {
          name: appName,
          short_name: short,
          description: '一个淡黄色风格的私密日记本，支持文字、图片、心情与日历回看。',
          lang: 'zh-CN',
          start_url: new URL('./index.html', url).href,
          scope: new URL('./', url).href,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#fbf3d6',
          theme_color: '#f6ecc6',
          icons: [
            { src: iconSrc, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ]
        };
        return new Response(JSON.stringify(mani), {
          headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' }
        });
      })()
    );
    return;
  }

  // 其余资源：缓存优先
  e.respondWith(
    caches.match(e.request).then(hit => {
      const fetchPromise = fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => hit);
      return hit || fetchPromise;
    })
  );
});
