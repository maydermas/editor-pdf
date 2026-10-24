// El texto editado se cambia dentro del propio PDF, con la misma fuente: sin parche blanco y
// con lo que se ve en pantalla igual a lo que se descarga.
// Uso: npm run build && node tests/edicion-real.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const S = (process.env.OUT_DIR || '/tmp/editor-pdf-real') + '/';
mkdirSync(S, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'OK  ' : 'FALLO'} ${name}${detail ? ' — ' + detail : ''}`); };

// Un contrato como los de Saki: cuerpo en Helvetica (sin incrustar), DNI en una letra ancha incrustada
// (subconjunto con solo sus cifras), fecha en Times y una tabla con fondo gris.
const d = await PDFDocument.create();
d.registerFontkit(fontkit);
const hel = await d.embedFont(StandardFonts.Helvetica);
const times = await d.embedFont(StandardFonts.TimesRoman);
const wide = await d.embedFont(readFileSync('node_modules/@fontsource/dejavu-sans/files/dejavu-sans-latin-400-normal.woff'), { subset: true });
const p = d.addPage([595, 842]);
p.drawText('De una parte, ANA MARIA COVACIU con N.I.E nº', { x: 70, y: 720, size: 10, font: hel });
p.drawText('Y9092530T', { x: 300, y: 720, size: 11, font: wide });
p.drawRectangle({ x: 66, y: 682, width: 300, height: 20, color: rgb(0.9, 0.9, 0.9) });
p.drawText('Importe total: 12.500,00 euros', { x: 70, y: 688, size: 10, font: hel, color: rgb(0.1, 0.2, 0.55) });
p.drawText('Fecha 09/07/2026 en Almeria', { x: 70, y: 660, size: 11, font: times });
writeFileSync(S + 'contrato.pdf', await d.save());

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4815', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => server.stdout.on('data', (x) => String(x).includes('4815') && r()));
const b = await chromium.launch();
try {
  const pg = await (await b.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2, acceptDownloads: true })).newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(String(e)));
  await pg.goto('http://localhost:4815/');
  await pg.setInputFiles('[data-testid="file-input"]', S + 'contrato.pdf');
  await pg.waitForSelector('.viewer .text-run');
  await pg.waitForTimeout(1200);
  const ov = await pg.locator('.page-overlay').first().boundingBox();
  const k = ov.width / 595;
  const clip = { x: ov.x + 60 * k, y: ov.y + 110 * k, width: 330 * k, height: 80 * k };
  await pg.screenshot({ path: S + 'antes.png', clip });
  const edit = async (label, from, to) => {
    // Una línea ya cambiada se vuelve a abrir tocando el texto nuevo, como haría el usuario.
    const done = pg.locator('.viewer .ann-text').filter({ hasText: from });
    await ((await done.count()) ? done.first() : pg.locator(`.viewer .text-run[aria-label*="${label}"]`).first()).click();
    await pg.waitForSelector('.text-editor');
    const v = await pg.locator('.text-editor').inputValue();
    await pg.locator('.text-editor').fill(v.replace(from, to));
    await pg.mouse.click(ov.x + 300, ov.y + 600);
    await pg.waitForTimeout(900);
  };
  await edit('12.500', '12.500,00', '98.765,43');
  await edit('09/07', '09/07/2026', '15/08/2027');
  await edit('Y9092530T', 'Y9092530T', 'Y2059390T');
  await pg.screenshot({ path: S + 'despues.png', clip });
  const ghosts = await pg.locator('.viewer .ann-text').evaluateAll((els) => els.map((e) => [e.textContent, getComputedStyle(e).opacity]));
  check('en pantalla el cambio está dentro de la página (no hay texto superpuesto)', ghosts.length === 3 && ghosts.every(([, o]) => o === '0'), JSON.stringify(ghosts));
  const covers = await pg.locator('.viewer .ann-whiteout').evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity));
  check('sin parches blancos visibles (el fondo gris se conserva)', covers.every((o) => o === '0'), JSON.stringify(covers));

  // Una cifra que la fuente incrustada no trae: se quita el original y se escribe con la letra parecida.
  await edit('Y9092530T', 'Y2059390T', 'Y4417786Q');
  await pg.screenshot({ path: S + 'despues2.png', clip });
  const dni = await pg.locator('.viewer .ann-text').filter({ hasText: 'Y4417786Q' }).evaluate((e) => getComputedStyle(e).opacity);
  check('si la fuente del PDF no tiene la letra, se ve el texto nuevo con la parecida', dni === '1', dni);

  await pg.getByRole('button', { name: /Listo/ }).click();
  const [download] = await Promise.all([pg.waitForEvent('download'), pg.getByRole('button', { name: /Descargar 1 página/ }).click()]);
  await download.saveAs(S + 'salida.pdf');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(S + 'salida.pdf')), isEvalSupported: false, verbosity: 0 }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  const items = tc.items.filter((i) => i.str.trim());
  const line = items.find((i) => i.str.includes('Importe'));
  check('el importe nuevo está en la misma línea y con la misma fuente', line?.str === 'Importe total: 98.765,43 euros', line?.str);
  const fecha = items.find((i) => i.str.includes('Fecha'));
  check('la fecha nueva sigue en Times, en la misma línea', fecha?.str === 'Fecha 15/08/2027 en Almeria', fecha?.str);
  const all = items.map((i) => i.str).join(' | ');
  check('no queda nada del texto antiguo', !/12\.500|09\/07|Y9092530T|Y2059390T/.test(all), all);
  check('el DNI nuevo está en el PDF', all.includes('Y4417786Q'), all);
  const ops = await page.getOperatorList();
  const rects = ops.fnArray.filter((f) => f === pdfjs.OPS.constructPath).length;
  check('solo hay un parche (el del DNI sin letras) y la tabla gris', rects <= 2, `${rects} trazados`);
  check('sin errores de JavaScript', !errors.length, errors.join(' '));
} finally {
  await b.close();
  server.kill();
}
console.log(fails ? `${fails} fallos` : 'Todo correcto');
process.exit(fails ? 1 : 0);
