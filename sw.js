// オフラインでも使えるようにするための仕組み（Service Worker）
// アプリ本体は最初に保存し、読み上げ音声は一度聞いたものから保存していく
const VERSION = 'v4';
const CORE = ['./', 'index.html', 'data.js', 'portrait.js', 'audio/timing.js', 'manifest.webmanifest', 'icons/icon-192.png', 'audio/joka.mp3', 'audio/joka_shimo.mp3'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => {
  // 「すべての音声を保存」：200個の音声をまとめて保存する
  if (e.data === 'cache-all-audio') {
    const files = [];
    for (let i = 1; i <= 100; i++) { const n = String(i).padStart(3, '0'); files.push(`audio/kami_${n}.mp3`, `audio/shimo_${n}.mp3`); }
    e.waitUntil(caches.open(VERSION).then(async c => {
      let done = 0;
      for (const f of files) {
        if (!(await c.match(f))) { try { await c.add(f); } catch (err) {} }
        done++;
        if (done % 20 === 0 || done === files.length) (await self.clients.matchAll()).forEach(cl => cl.postMessage({ cached: done, total: files.length }));
      }
    }));
  }
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // 音声はRangeリクエストで来ることがあるので、保存済みなら丸ごと返す
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request.url, { ignoreSearch: true });
    if (hit) return e.request.headers.has('range') ? rangeResponse(hit, e.request.headers.get('range')) : hit;
    try {
      const res = await fetch(e.request);
      if (res.ok && res.status === 200 && !e.request.headers.has('range') && (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('/'))) c.put(e.request, res.clone());
      return res;
    } catch (err) {
      return (await c.match('index.html')) || Response.error();
    }
  }));
});

// iPhone の Safari は音声を「Range（部分ごと）」で要求するので、保存した音声から必要な部分を切り出して返す
async function rangeResponse(res, range) {
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const size = buf.byteLength;
  let start = m[1] ? +m[1] : 0, end = m[2] ? +m[2] : size - 1;
  if (!m[1] && m[2]) { start = size - +m[2]; end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' },
  });
}
