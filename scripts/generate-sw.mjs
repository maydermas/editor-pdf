// Genera dist/sw.js con la lista de archivos del build para que la app funcione sin conexión.
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const DIST = 'dist';
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name !== 'sw.js') files.push(relative(DIST, p).split('\\').join('/'));
  }
};
walk(DIST);

// Las fuentes y CMaps de pdf.js se guardan al usarse, no de entrada (son muchos archivos).
const precache = ['./', ...files.filter((f) => !f.startsWith('pdfjs/'))];
const hash = createHash('sha256');
for (const f of files.sort()) hash.update(f).update(readFileSync(join(DIST, f)));
const version = hash.digest('hex').slice(0, 12);

writeFileSync(
  join(DIST, 'sw.js'),
  `const CACHE = 'editor-pdf-${version}';
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Navegación: siempre la versión nueva de la red (sin la caché HTTP de 10 min de GitHub Pages);
  // sin conexión, la página principal guardada.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req, { cache: 'no-cache' }).catch(() => caches.match('./')));
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`,
);
console.log(`sw.js: ${precache.length} archivos precargados, versión ${version}`);
