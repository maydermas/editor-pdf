// Editar números (DNI, importes, fechas) mantiene su tamaño y aspecto aunque el PDF use otra letra para ellos.
// Uso: npm run build && node tests/edit-numbers.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, TextRenderingMode, popGraphicsState, pushGraphicsState, setCharacterSqueeze, setTextRenderingMode } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = (process.env.OUT_DIR || '/tmp/editor-pdf-numbers') + '/';
mkdirSync(S, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FALLO'} ${name}${detail ? ' — ' + detail : ''}`); };

const b = await chromium.launch();
// Un DNI que se ve más alto de lo que declara el PDF (como en los contratos escaneados o generados con
// otra letra): se pinta como imagen a 12,5 pt y encima va el texto invisible a 10 pt.
const tall = await (await b.newPage()).evaluate(() => {
  const k = 8, size = 12.5 * k;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${size}px Arial, Helvetica, sans-serif`;
  c.width = Math.ceil(ctx.measureText('Y9092530T').width) + 4;
  c.height = Math.ceil(size * 1.3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#000';
  ctx.font = `${size}px Arial, Helvetica, sans-serif`;
  ctx.fillText('Y9092530T', 2, size);
  return { url: c.toDataURL('image/png'), w: c.width / k, h: c.height / k, base: size / k };
});
const d = await PDFDocument.create();
d.registerFontkit(fontkit);
const hel = await d.embedFont(StandardFonts.Helvetica);
const times = await d.embedFont(StandardFonts.TimesRoman);
// Letra ancha desconocida para el editor (como Verdana en los contratos de Word).
const wide = await d.embedFont(readFileSync('node_modules/@fontsource/dejavu-sans/files/dejavu-sans-latin-400-normal.woff'), { subset: true });
// Y otra que el editor no conoce y debe imitar estirando la parecida (Inter del sistema si está).
const INTER = '/usr/share/fonts/opentype/inter/Inter-Regular.otf';
const other = existsSync(INTER) ? await d.embedFont(readFileSync(INTER), { subset: true }) : times;
const p = d.addPage([595, 842]);
p.drawText('De una parte, ANA MARIA COVACIU con N.I.E nº', { x: 70, y: 720, size: 10, font: hel });
p.drawText('Y9092530T', { x: 300, y: 720, size: 11, font: wide });
p.drawText('Importe total:', { x: 70, y: 690, size: 10, font: hel });
p.drawText('12.500,00', { x: 140, y: 690, size: 10, font: other });
p.drawText('Fecha 09/07/2026', { x: 300, y: 690, size: 10, font: times });
const img = await d.embedPng(Buffer.from(tall.url.split(',')[1], 'base64'));
p.drawImage(img, { x: 300 - 2 / 8, y: 630 - (tall.h - tall.base), width: tall.w, height: tall.h });
p.drawText('DNI', { x: 270, y: 630, size: 10, font: hel });
p.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Invisible), setCharacterSqueeze(125));
p.drawText('Y9092530T', { x: 300, y: 630, size: 10, font: hel });
p.pushOperators(popGraphicsState());
p.drawText('Telefono 950 123 456 y codigo postal 04740', { x: 70, y: 660, size: 10, font: hel });
writeFileSync(S + 'numeros.pdf', await d.save());

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4802', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => server.stdout.on('data', (x) => String(x).includes('4802') && r()));
try {
  const t = await b.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2, acceptDownloads: true });
  const pg = await t.newPage();
  await pg.goto('http://localhost:4802/');
  await pg.setInputFiles('[data-testid="file-input"]', S + 'numeros.pdf');
  await pg.waitForSelector('.viewer .text-run');
  await pg.waitForTimeout(1200);
  const ov = await pg.locator('.page-overlay').first().boundingBox();
  const k = ov.width / 595;
  const clip = { x: ov.x + 60 * k, y: ov.y + 105 * k, width: 330 * k, height: 110 * k };
  await pg.screenshot({ path: S + 'n0.png', clip });
  const edit = async (label, from, to) => {
    const runEl = pg.locator(`.viewer .text-run[aria-label*="${label}"]`).first();
    const before = (await runEl.boundingBox()).width;
    const full = (await runEl.getAttribute("aria-label")) === `Editar texto: ${from}`; // se sustituye la línea entera
    await pg.locator(`.viewer .text-run[aria-label*="${label}"]`).first().click();
    await pg.waitForSelector('.text-editor');
    const v = await pg.locator('.text-editor').inputValue();
    await pg.locator('.text-editor').fill(v.replace(from, to));
    await pg.mouse.click(ov.x + 300, ov.y + 600);
    await pg.waitForTimeout(500);
    const ann = pg.locator('.viewer .ann-text').filter({ hasText: to.split(' ').pop() });
    const after = (await ann.last().boundingBox())?.width ?? 0;
    if (full) check(`«${to}» ocupa lo mismo que «${from}»`, Math.abs(after / (before) - 1) < 0.06, `${after.toFixed(1)} vs ${before.toFixed(1)}`);
  };
  await edit('Y9092530T', 'Y9092530T', 'Y1234567T');
  await edit('12.500', '12.500,00', '13.750,00');
  await edit('09/07', '09/07/2026', '15/08/2026');
  await edit('950', '950 123 456', '950 987 654');
  // El DNI más alto que lo que declara el PDF: se iguala la altura que se ve, no la declarada.
  await pg.locator('.viewer .text-run[aria-label="Editar texto: Y9092530T"]').last().click();
  await pg.waitForSelector('.text-editor');
  await pg.locator('.text-editor').fill('54122328Q');
  await pg.mouse.click(ov.x + 300, ov.y + 600);
  await pg.waitForTimeout(500);
  const tallSize = await pg.locator('.viewer .ann-text').filter({ hasText: '54122328Q' }).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  check('un número que se ve más alto que lo declarado conserva su altura', Math.abs(tallSize / 12.5 - 1) < 0.06, `${tallSize} pt (se ve a 12,5)`);
  await pg.screenshot({ path: S + 'n1.png', clip });
  const sizes = await pg.locator('.viewer .ann-text').evaluateAll((els) => els.map((e) => getComputedStyle(e).fontSize));
  check('los números nuevos conservan el tamaño de letra original', JSON.stringify(sizes.slice(0, 4)) === JSON.stringify(['11px', '10px', '10px', '10px']), JSON.stringify(sizes));
  const anns = await pg.locator('.viewer .ann-text').evaluateAll((els) => els.map((e) => ({ t: e.textContent, w: e.getBoundingClientRect().width, ff: getComputedStyle(e).fontFamily, fs: getComputedStyle(e).fontSize, tr: getComputedStyle(e).transform })));
  if (process.env.DEBUG) console.log(JSON.stringify(anns, null, 1));

  // Al descargar, los números nuevos miden en el PDF lo mismo que los originales.
  await pg.getByRole('button', { name: /Listo/ }).click();
  const [download] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: /Descargar 1 página/ }).click()]);
  await download.saveAs(S + 'salida.pdf');
  const widths = async (file) => {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)), isEvalSupported: false, verbosity: 0 }).promise;
    const tc = await (await doc.getPage(1)).getTextContent();
    return Object.fromEntries(tc.items.filter((i) => i.str.trim()).map((i) => [i.str, i.width]));
  };
  const a0 = await widths(S + 'numeros.pdf');
  const a1 = await widths(S + 'salida.pdf');
  for (const [o, n] of [['Y9092530T', 'Y1234567T'], ['12.500,00', '13.750,00']]) {
    check(`en el PDF descargado «${n}» mide como «${o}»`, !!a1[n] && Math.abs(a1[n] / a0[o] - 1) < 0.06, `${a1[n]?.toFixed(1)} vs ${a0[o]?.toFixed(1)}`);
  }
} finally {
  await b.close();
  server.kill();
}
console.log(fails ? `${fails} fallos` : 'Todo correcto');
process.exit(fails ? 1 : 0);
