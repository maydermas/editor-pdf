// En el móvil: editar una línea, pulsar Listo y descargar. El archivo lleva el cambio y otro nombre que el original.
// Uso: npm run build && node tests/edit-patch.mjs && node tests/descarga-movil.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const SRC = (process.env.OUT_DIR_PATCH || '/tmp/editor-pdf-patch') + '/contrato.pdf';
const OUT = '/tmp/editor-pdf-descarga.pdf';
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FALLO'} ${name}${detail ? ' — ' + detail : ''}`); };
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4811', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => server.stdout.on('data', (x) => String(x).includes('4811') && r()));
const b = await chromium.launch();
try {
  const pg = await (await b.newContext({ ...devices['iPhone 13'], acceptDownloads: true })).newPage();
  await pg.goto('http://localhost:4811/');
  await pg.setInputFiles('[data-testid="file-input"]', SRC);
  await pg.waitForSelector('.viewer .text-run');
  await pg.waitForTimeout(1200);
  const bb = await pg.locator('.viewer .text-run[aria-label*="Y9092530T"]').first().boundingBox();
  await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await pg.waitForSelector('.text-editor');
  const v = await pg.locator('.text-editor').inputValue();
  await pg.locator('.text-editor').fill(v.replace('Y9092530T', '54122328Q'));
  // Se pulsa Listo con el teclado aún abierto, como en el iPhone.
  await pg.locator('.done-btn').tap();
  let early = false;
  pg.once('download', () => (early = true));
  await pg.getByRole('button', { name: /Descargar 1/ }).tap();
  await pg.waitForSelector('.done-badge');
  await pg.waitForTimeout(300);
  check('en el móvil no se descarga solo (iOS lo bloquea sin un toque)', !early);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: /^Descargar$/ }).tap()]);
  check('el archivo se llama distinto del original', dl.suggestedFilename() === 'contrato-editado.pdf', dl.suggestedFilename());
  await dl.saveAs(OUT);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(OUT)), isEvalSupported: false, verbosity: 0 }).promise;
  const text = (await (await doc.getPage(1)).getTextContent()).items.map((i) => i.str).join(' ');
  check('el PDF descargado lleva el cambio', text.includes('54122328Q'), text);
} finally {
  await b.close();
  server.kill();
}
console.log(fails ? `${fails} fallos` : 'Todo correcto');
process.exit(fails ? 1 : 0);
