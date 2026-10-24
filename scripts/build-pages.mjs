// Genera las páginas estáticas (guías y legales), sitemap.xml, robots.txt y ads.txt en dist/.
// Son HTML normal para que Google y AdSense puedan leer el contenido sin ejecutar JavaScript.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { guias } from '../content/guias.mjs';
import { legales } from '../content/legales.mjs';
import { herramientas } from '../content/herramientas.mjs';

const site = JSON.parse(readFileSync('site.config.json', 'utf8'));
const DIST = 'dist';
const base = site.siteUrl.replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);
const fechaLarga = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const ads = site.adsense;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Sin NIF configurado, se quitan las referencias en lugar de dejar un hueco.
const dropNif = (s) => (site.owner.taxId ? s : s.replace(/\s*<li><strong>NIF:<\/strong> \{\{nif\}\}<\/li>/g, '').replaceAll(', NIF {{nif}}', ''));
const fill = (s) =>
  dropNif(s)
    .replaceAll('{{nombre}}', site.name)
    .replaceAll('{{web}}', base)
    .replaceAll('{{email}}', site.supportEmail)
    .replaceAll('{{titular}}', site.owner.name)
    .replaceAll('{{nif}}', site.owner.taxId)
    .replaceAll('{{direccion}}', site.owner.address)
    .replaceAll('{{pais}}', site.owner.country)
    .replaceAll('{{fecha}}', fechaLarga);

const adBlock = (slot) =>
  ads.client && ads.slots[slot]
    ? `<div class="ad-wrap"><span class="ad-label">Publicidad</span><ins class="adsbygoogle" style="display:block" data-ad-client="${ads.client}" data-ad-slot="${ads.slots[slot]}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
    : '';

const LEGAL_LINKS = [
  ['sobre-nosotros', 'Sobre nosotros'],
  ['contacto', 'Contacto'],
  ['aviso-legal', 'Aviso legal'],
  ['politica-de-privacidad', 'Privacidad'],
  ['politica-de-cookies', 'Cookies'],
];

function layout({ prefix, path, title, description, content, jsonLd }) {
  const url = `${base}/${path}`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} | ${esc(site.name)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="${esc(site.name)}" />
<meta name="theme-color" content="#4F46E5" />
<link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml" />
<link rel="manifest" href="${prefix}manifest.webmanifest" />
<link rel="stylesheet" href="${prefix}static.css" />
${ads.client ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.client}" crossorigin="anonymous"></script>` : ''}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
<header class="site-head"><div class="container row">
  <a class="logo" href="${prefix}"><img src="${prefix}favicon.svg" alt="" width="28" height="28" />${esc(site.name)}</a>
  <nav class="nav"><a href="${prefix}guias/">Guías</a><a href="${prefix}contacto/">Contacto</a></nav>
  <a class="btn" href="${prefix}">Abrir el editor</a>
</div></header>
<main class="container article">${content}</main>
<footer class="site-foot"><div class="container">
  <nav class="foot-links foot-tools" aria-label="Lo más buscado">
    ${herramientas.map((h) => `<a href="${prefix}${h.slug}/">${esc(h.enlace)}</a>`).join('\n    ')}
  </nav>
  <nav class="foot-links">
    <a href="${prefix}guias/">Guías</a>
    ${LEGAL_LINKS.map(([s, t]) => `<a href="${prefix}${s}/">${t}</a>`).join('\n    ')}
    <a href="#" class="privacy-choices">Preferencias de privacidad</a>
  </nav>
  <p>© ${new Date().getFullYear()} ${esc(site.name)}. Tus documentos se procesan en tu navegador.</p>
</div></footer>
<script>
document.querySelectorAll('.privacy-choices').forEach(function (a) {
  a.addEventListener('click', function (e) {
    e.preventDefault();
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    window.googlefc.callbackQueue.push(function () { window.googlefc.showRevocationMessage && window.googlefc.showRevocationMessage(); });
  });
});
</script>
</body>
</html>
`;
}

const write = (path, html) => {
  mkdirSync(join(DIST, path), { recursive: true });
  writeFileSync(join(DIST, path, 'index.html'), html);
};

// Guías
for (const g of guias) {
  const body = fill(g.body);
  const firstP = body.indexOf('</p>');
  const withAd = firstP > -1 ? body.slice(0, firstP + 4) + adBlock('article') + body.slice(firstP + 4) : body;
  const related = guias.filter((o) => o.slug !== g.slug).slice(0, 4);
  write(
    `guias/${g.slug}`,
    layout({
      prefix: '../../',
      path: `guias/${g.slug}/`,
      title: g.title,
      description: fill(g.description),
      jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: fill(g.description), dateModified: today, inLanguage: 'es', publisher: { '@type': 'Organization', name: site.name } },
      content: `
<p class="crumbs"><a href="../../">Inicio</a> › <a href="../">Guías</a></p>
<h1>${esc(g.title)}</h1>
<p class="lead">${esc(fill(g.description))}</p>
${withAd}
<div class="cta"><strong>Pruébalo ahora</strong><span>Gratis, sin registro y sin subir tus archivos.</span><a class="btn" href="../../">Abrir el editor</a></div>
${adBlock('article')}
<h2>Otras guías</h2>
<ul class="related">${related.map((r) => `<li><a href="../${r.slug}/">${esc(r.title)}</a></li>`).join('')}</ul>`,
    }),
  );
}

// Páginas para búsquedas concretas
for (const h of herramientas) {
  const otras = herramientas.filter((o) => o.slug !== h.slug);
  write(
    h.slug,
    layout({
      prefix: '../',
      path: `${h.slug}/`,
      title: h.title,
      description: fill(h.description),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: h.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
      content: `
<p class="crumbs"><a href="../">Inicio</a></p>
<h1>${esc(h.title)}</h1>
<p class="lead">${esc(fill(h.description))}</p>
<p><a class="btn btn-big" href="../">Abrir el editor gratis</a></p>
<h2>Cómo hacerlo</h2>
<ol class="steps">${h.pasos.map((p) => `<li>${p}</li>`).join('')}</ol>
${adBlock('article')}
${fill(h.body)}
<div class="cta"><strong>Listo en un minuto</strong><span>Gratis, sin registro y sin subir tus archivos.</span><a class="btn" href="../">Abrir el editor</a></div>
<h2>Preguntas frecuentes</h2>
${h.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}
${adBlock('article')}
<h2>También te puede servir</h2>
<ul class="related">${otras.map((o) => `<li><a href="../${o.slug}/">${esc(o.title)}</a></li>`).join('')}</ul>`,
    }),
  );
}

// Índice de guías
write(
  'guias',
  layout({
    prefix: '../',
    path: 'guias/',
    title: 'Guías para trabajar con PDF',
    description: `Aprende a editar, firmar, comprimir, unir, dividir y convertir PDF con ${site.name}.`,
    content: `
<p class="crumbs"><a href="../">Inicio</a></p>
<h1>Guías para trabajar con PDF</h1>
<p class="lead">Explicaciones paso a paso para las tareas más habituales con documentos PDF.</p>
<div class="cards">${guias.map((g) => `<a class="card" href="./${g.slug}/"><strong>${esc(g.title)}</strong><span>${esc(fill(g.description))}</span></a>`).join('')}</div>
<h2>Lo más buscado</h2>
<div class="cards">${herramientas.map((h) => `<a class="card" href="../${h.slug}/"><strong>${esc(h.title)}</strong><span>${esc(fill(h.description))}</span></a>`).join('')}</div>
${adBlock('article')}`,
  }),
);

// Páginas legales
for (const l of legales) {
  write(
    l.slug,
    layout({
      prefix: '../',
      path: `${l.slug}/`,
      title: l.title,
      description: fill(l.description),
      content: `<p class="crumbs"><a href="../">Inicio</a></p><h1>${esc(l.title)}</h1>${fill(l.body)}`,
    }),
  );
}

// Estilos de las páginas de contenido (comparten paleta con la app).
writeFileSync(
  join(DIST, 'static.css'),
  `:root{--primary:#4f46e5;--primary-strong:#4338ca;--tint:#eef2ff;--border:#e3e5ec;--text:#151826;--muted:#646a7e;--bg:#fff;--alt:#f6f7fb}
*{box-sizing:border-box}body{margin:0;font:16px/1.65 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--text);background:var(--bg)}
a{color:var(--primary)}h1,h2,h3{line-height:1.2;letter-spacing:-.02em;text-wrap:balance}h1{font-size:clamp(28px,5vw,40px);margin:8px 0 12px}h2{font-size:24px;margin:36px 0 10px}
.container{max-width:1100px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.site-head{border-bottom:1px solid var(--border);position:sticky;top:0;background:rgba(255,255,255,.95);backdrop-filter:blur(8px);z-index:5}
.row{display:flex;align-items:center;gap:20px;height:64px}.logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:18px;color:var(--text);text-decoration:none}
.nav{display:flex;gap:18px;margin-left:auto}.nav a{color:var(--text);text-decoration:none;font-weight:500}
.btn{display:inline-block;background:var(--primary);color:#fff;text-decoration:none;font-weight:600;border-radius:8px;padding:9px 16px;font-size:14px;white-space:nowrap}.btn:hover{background:var(--primary-strong)}
.article{max-width:760px;padding-block:28px 56px}.lead{font-size:19px;color:var(--muted)}.crumbs{font-size:14px;color:var(--muted)}.crumbs a{color:var(--muted)}
li{margin:6px 0}code{background:var(--alt);padding:1px 6px;border-radius:5px;font-size:.92em}.muted{color:var(--muted);font-size:14px}
.cta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;background:var(--tint);border-radius:12px;padding:18px 20px;margin:36px 0}.cta span{color:var(--muted);flex:1;min-width:200px}
.related{padding-left:20px}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:24px}
.card{display:flex;flex-direction:column;gap:6px;border:1px solid var(--border);border-radius:12px;padding:18px;text-decoration:none;color:var(--text)}.card:hover{border-color:#c7d2fe}.card span{color:var(--muted);font-size:14px}
.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid var(--border);padding:8px 10px;text-align:left;vertical-align:top}th{background:var(--alt)}
.big-contact{font-size:22px;font-weight:700}.ad-wrap{margin:28px 0;min-height:100px}.ad-label{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.site-foot{border-top:1px solid var(--border);padding-block:24px;font-size:14px;color:var(--muted)}.foot-tools{margin-bottom:10px}.btn-big{font-size:16px;padding:12px 22px}.steps li{margin:8px 0}h3{font-size:18px;margin:22px 0 6px}.foot-links{display:flex;flex-wrap:wrap;gap:8px 18px}.foot-links a{color:var(--muted)}
@media (max-width:640px){.nav{display:none}.row{justify-content:space-between}}
`,
);

// sitemap, robots y ads.txt
const urls = ['', 'guias/', ...herramientas.map((h) => `${h.slug}/`), ...guias.map((g) => `guias/${g.slug}/`), ...legales.map((l) => `${l.slug}/`)];
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${base}/${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`,
);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);
if (ads.client) writeFileSync(join(DIST, 'ads.txt'), `google.com, ${ads.client.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);

console.log(`Páginas estáticas: ${urls.length - 1} + sitemap.xml, robots.txt${ads.client ? ', ads.txt' : ''}`);
