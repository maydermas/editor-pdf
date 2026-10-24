// Prueba de extremo a extremo con Playwright (Chromium preinstalado).
// Uso: npm run build && OUT_DIR=/ruta/salida node tests/e2e.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.env.OUT_DIR || '/tmp/editor-pdf-e2e';
mkdirSync(OUT, { recursive: true });
const PORT = 4791;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${name}${detail ? ' — ' + detail : ''}`);
};

// Documento de prueba: página vertical y página con /Rotate 90.
const src = await PDFDocument.create();
const font = await src.embedFont(StandardFonts.Helvetica);
const p1 = src.addPage([595, 842]);
p1.drawText('Documento de prueba - pagina 1', { x: 50, y: 780, size: 20, font });
const p2 = src.addPage([595, 842]);
p2.drawText('Pagina 2 girada', { x: 50, y: 780, size: 20, font });
p2.setRotation(degrees(90));
const srcPath = join(OUT, 'entrada.pdf');
writeFileSync(srcPath, await src.save());

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res());
  server.on('exit', () => rej(new Error('vite preview terminó')));
  setTimeout(() => rej(new Error('vite preview no arrancó')), 20000);
});

const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:${PORT}/`);
  await page.screenshot({ path: join(OUT, 'portada-1280.png'), fullPage: true });
  check('portada carga', await page.getByRole('heading', { level: 1 }).isVisible());

  await page.setInputFiles('[data-testid="file-input"]', srcPath);
  await page.waitForSelector('.page-slot');
  await page.waitForTimeout(800);
  const slots = await page.locator('.page-slot').count();
  check('abre el PDF con 2 páginas', slots === 2, `páginas=${slots}`);
  const p2box = await page.locator('.page-wrap').nth(1).boundingBox();
  check('página con /Rotate 90 se muestra apaisada', p2box.width > p2box.height, `${Math.round(p2box.width)}×${Math.round(p2box.height)}`);

  // Texto
  await page.getByRole('button', { name: /^Texto/ }).click();
  const first = page.locator('.page-overlay').first();
  const fb = await first.boundingBox();
  await page.mouse.click(fb.x + 80, fb.y + 160);
  await page.keyboard.type('Hola mundo ñandú');
  await page.mouse.click(fb.x + 400, fb.y + 500); // termina la edición
  check('texto añadido', (await page.locator('.viewer .ann-text').count()) === 1);

  // Rectángulo arrastrando
  await page.getByRole('button', { name: /Formas/ }).click();
  await page.getByRole('menuitem', { name: /Rectángulo/ }).click();
  await page.mouse.move(fb.x + 100, fb.y + 250);
  await page.mouse.down();
  await page.mouse.move(fb.x + 260, fb.y + 330, { steps: 5 });
  await page.mouse.up();
  check('rectángulo dibujado', (await page.locator('.viewer rect.ann-stroke').count()) >= 1);

  // Deshacer / rehacer
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  const afterUndo = await page.locator('.page-slot').first().locator('rect.ann-stroke').count();
  await page.keyboard.press('Control+Shift+z');
  const afterRedo = await page.locator('.page-slot').first().locator('rect.ann-stroke').count();
  check('deshacer y rehacer', afterUndo === 0 && afterRedo === 1, `deshacer=${afterUndo} rehacer=${afterRedo}`);

  // Mover el texto con la herramienta de selección
  await page.getByRole('button', { name: /^Seleccionar/ }).click();
  const tb = await page.locator('.viewer .ann-text').first().boundingBox();
  await page.mouse.move(tb.x + 10, tb.y + tb.height / 2);
  await page.mouse.down();
  await page.mouse.move(tb.x + 60, tb.y + tb.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  const tb2 = await page.locator('.viewer .ann-text').first().boundingBox();
  check('mover anotación', Math.abs(tb2.x - tb.x - 50) < 3 && Math.abs(tb2.y - tb.y - 40) < 3, `dx=${Math.round(tb2.x - tb.x)} dy=${Math.round(tb2.y - tb.y)}`);

  // Firma dibujada y colocada en la página 2
  await page.getByRole('button', { name: /^Firmar/ }).click();
  const pad = await page.locator('.sig-pad canvas').boundingBox();
  await page.mouse.move(pad.x + 40, pad.y + 120);
  await page.mouse.down();
  for (let i = 0; i < 20; i++) await page.mouse.move(pad.x + 40 + i * 15, pad.y + 120 + Math.sin(i) * 30);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Usar firma' }).click();
  const second = await page.locator('.page-overlay').nth(1).boundingBox();
  await page.locator('.page-wrap').nth(1).scrollIntoViewIfNeeded();
  const s2 = await page.locator('.page-overlay').nth(1).boundingBox();
  await page.mouse.click(s2.x + s2.width / 2, s2.y + s2.height / 2);
  check('firma colocada', (await page.locator('.page-slot').nth(1).locator('image').count()) === 1, `caja=${Math.round(second.width)}`);

  // Nota
  await page.getByRole('button', { name: /^Nota/ }).click();
  await page.locator('.viewer').evaluate((el) => (el.scrollTop = 0));
  const f2 = await page.locator('.page-overlay').first().boundingBox();
  await page.mouse.click(f2.x + 400, f2.y + 120);
  await page.getByLabel('Texto de la nota').fill('Revisar esta cifra');
  await page.getByRole('button', { name: 'Guardar' }).click();

  // Girar la página 1 desde las miniaturas
  await page.getByRole('button', { name: 'Girar a la derecha' }).first().click();
  const p1box = await page.locator('.page-wrap').first().boundingBox();
  check('girar página', p1box.width > p1box.height);

  await page.screenshot({ path: join(OUT, 'editor-1280.png') });

  // Exportar PDF
  await page.getByRole('button', { name: /Listo/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar 2 páginas/ }).click()]);
  const outPath = join(OUT, 'salida.pdf');
  await download.saveAs(outPath);
  await page.getByText('está listo').waitFor();

  const data = new Uint8Array(readFileSync(outPath));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  check('PDF exportado con 2 páginas', doc.numPages === 2, `páginas=${doc.numPages}`);
  const pg1 = await doc.getPage(1);
  const pg2 = await doc.getPage(2);
  const text = (await pg1.getTextContent()).items.map((i) => i.str).join(' ');
  check('el texto añadido está en el PDF', text.includes('Hola mundo ñandú'), JSON.stringify(text));
  check('rotaciones exportadas (90 y 90)', pg1.rotate === 90 && pg2.rotate === 90, `p1=${pg1.rotate} p2=${pg2.rotate}`);
  const annots = await pg1.getAnnotations();
  check('la nota es un comentario PDF', annots.some((a) => a.subtype === 'Text' && (a.contentsObj?.str ?? a.contents) === 'Revisar esta cifra'));
  const ops = await pg2.getOperatorList();
  check('la firma es una imagen en la página 2', ops.fnArray.includes(pdfjs.OPS.paintImageXObject));

  // Posición: el texto debe estar arriba a la izquierda de la página 1 (vista sin rotación de usuario).
  const item = (await pg1.getTextContent()).items.find((i) => i.str.includes('Hola'));
  const [, , , , tx, ty] = item.transform;
  check('posición del texto coherente', tx > 30 && tx < 200 && ty > 600 && ty < 842, `x=${tx.toFixed(0)} y=${ty.toFixed(0)}`);

  // Exportar rango como JPG
  await page.getByRole('button', { name: 'Seguir editando' }).click();
  await page.getByRole('button', { name: /Listo/ }).click();
  await page.getByText('JPG', { exact: true }).click();
  await page.getByPlaceholder(/Todas/).fill('2');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar 1 página/ }).click()]);
  check('exportar página 2 como JPG', dl2.suggestedFilename().endsWith('.jpg'), dl2.suggestedFilename());
  await dl2.saveAs(join(OUT, 'salida-p2.jpg'));

  // Rango inválido
  await page.getByRole('button', { name: 'Seguir editando' }).click();
  await page.getByRole('button', { name: /Listo/ }).click();
  await page.getByPlaceholder(/Todas/).fill('7');
  check('rango inválido bloquea la descarga', await page.getByRole('button', { name: /Descargar/ }).isDisabled());
  await page.keyboard.press('Escape');

  // Móvil
  const m = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push(String(e)));
  await mp.goto(`http://localhost:${PORT}/`);
  await mp.screenshot({ path: join(OUT, 'portada-375.png'), fullPage: true });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check('portada sin scroll horizontal en móvil', !overflow);
  await mp.setInputFiles('[data-testid="file-input"]', srcPath);
  await mp.waitForSelector('.page-slot');
  await mp.waitForTimeout(800);
  await mp.screenshot({ path: join(OUT, 'editor-375.png') });
  const mOverflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check('editor sin scroll horizontal en móvil', !mOverflow);

  check('sin errores de JavaScript', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('ejecución sin excepciones', false, String(e?.stack || e));
} finally {
  await browser.close();
  server.kill();
}

writeFileSync(join(OUT, 'resultados.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} comprobaciones correctas. Salida en ${OUT}`);
process.exit(failed ? 1 : 0);
