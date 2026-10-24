// Prueba de extremo a extremo con Playwright (Chromium preinstalado).
// Uso: npm run build && OUT_DIR=/ruta/salida node tests/e2e.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
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
const p3 = src.addPage([595, 842]);
const timesBold = await src.embedFont(StandardFonts.TimesRomanBold);
p3.drawRectangle({ x: 0, y: 700, width: 595, height: 60, color: rgb(0.9, 0.9, 0.9) });
p3.drawText('Factura numero 1234', { x: 60, y: 722, size: 18, font: timesBold, color: rgb(0.1, 0.2, 0.7) });
p3.drawText('Texto que no se toca', { x: 60, y: 600, size: 12, font });
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
  check('abre el PDF con 3 páginas', slots === 3, `páginas=${slots}`);
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

  // Editar un texto que ya trae el PDF (página 3): conserva fuente, color y fondo.
  await page.getByRole('button', { name: /^Texto/ }).click();
  await page.locator('.page-wrap').nth(2).scrollIntoViewIfNeeded();
  const run = page.getByRole('button', { name: 'Editar texto: Factura numero 1234' });
  await run.waitFor();
  await run.click();
  const ed = page.locator('.text-editor');
  check('el texto original se abre para editar con su contenido', (await ed.inputValue()) === 'Factura numero 1234');
  const edStyle = await ed.evaluate((el) => ({ w: getComputedStyle(el).fontWeight, f: getComputedStyle(el).fontFamily, c: getComputedStyle(el).color }));
  const near = (css, rgbWanted) => (css.match(/\d+/g) || []).slice(0, 3).every((v, i) => Math.abs(Number(v) - rgbWanted[i]) <= 4);
  check('conserva negrita, tipo de letra y color', edStyle.w === '700' && /Times/.test(edStyle.f) && near(edStyle.c, [26, 51, 179]), JSON.stringify(edStyle));
  await ed.fill('Factura numero 5678');
  await page.keyboard.press('Escape');
  const coverFill = await page.locator('.page-slot').nth(2).locator('.viewer .ann-whiteout, .ann-whiteout').first().getAttribute('fill');
  check('el parche usa el color del fondo', /^#e[4-8]e[4-8]e[4-8]$/.test(coverFill || ''), coverFill);
  await page.getByRole('button', { name: /^Seleccionar/ }).click();
  await page.locator('.viewer').evaluate((el) => (el.scrollTop = 0));

  await page.screenshot({ path: join(OUT, 'editor-1280.png') });

  // Exportar PDF
  await page.getByRole('button', { name: /Listo/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar 3 páginas/ }).click()]);
  const outPath = join(OUT, 'salida.pdf');
  await download.saveAs(outPath);
  await page.getByText('está listo').waitFor();

  const data = new Uint8Array(readFileSync(outPath));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  check('PDF exportado con 3 páginas', doc.numPages === 3, `páginas=${doc.numPages}`);
  const pg1 = await doc.getPage(1);
  const pg2 = await doc.getPage(2);
  const text = (await pg1.getTextContent()).items.map((i) => i.str).join(' ');
  check('el texto añadido está en el PDF', text.includes('Hola mundo ñandú'), JSON.stringify(text));
  check('rotaciones exportadas (90 y 90)', pg1.rotate === 90 && pg2.rotate === 90, `p1=${pg1.rotate} p2=${pg2.rotate}`);
  const annots = await pg1.getAnnotations();
  check('la nota es un comentario PDF', annots.some((a) => a.subtype === 'Text' && (a.contentsObj?.str ?? a.contents) === 'Revisar esta cifra'));
  const ops = await pg2.getOperatorList();
  check('la firma es una imagen en la página 2', ops.fnArray.includes(pdfjs.OPS.paintImageXObject));

  const pg3 = await doc.getPage(3);
  const t3 = (await pg3.getTextContent()).items.map((i) => i.str).join(' | ');
  check('el texto reescrito y el resto están en el PDF', t3.includes('Factura numero 5678') && t3.includes('Texto que no se toca'), t3);

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

  // Arrastrar con el ratón (herramienta Texto) mueve el documento y no crea texto.
  await page.getByRole('button', { name: /^Texto/ }).click();
  await page.locator('.viewer').evaluate((el) => (el.scrollTop = 0));
  const annsBefore = await page.locator('.viewer [data-ann]').count();
  const ov = await page.locator('.page-overlay').first().boundingBox();
  await page.mouse.move(ov.x + 300, ov.y + 400);
  await page.mouse.down();
  await page.mouse.move(ov.x + 300, ov.y + 150, { steps: 8 });
  await page.mouse.up();
  const scrolled = await page.locator('.viewer').evaluate((el) => el.scrollTop);
  check('arrastrar con el ratón mueve el documento', scrolled > 200 && (await page.locator('.viewer [data-ann]').count()) === annsBefore, `scrollTop=${scrolled}`);

  // Ctrl + rueda: amplía manteniendo el punto bajo el ratón.
  const wrap0 = await page.locator('.page-wrap').first().boundingBox();
  const mx = wrap0.x + wrap0.width * 0.7;
  const my = Math.max(wrap0.y, 250) + 50;
  const fx = (mx - wrap0.x) / wrap0.width;
  const fy = (my - wrap0.y) / wrap0.height;
  await page.mouse.move(mx, my);
  await page.keyboard.down('Control');
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await page.waitForTimeout(300);
  const wrap1 = await page.locator('.page-wrap').first().boundingBox();
  const driftX = wrap1.x + fx * wrap1.width - mx;
  const driftY = wrap1.y + fy * wrap1.height - my;
  check('Ctrl + rueda amplía donde está el ratón', wrap1.width > wrap0.width * 1.5 && Math.abs(driftX) < 6 && Math.abs(driftY) < 6, `ancho ${Math.round(wrap0.width)}→${Math.round(wrap1.width)}, desvío ${Math.round(driftX)},${Math.round(driftY)}`);
  const leftReachable = await page.locator('.viewer').evaluate((el) => {
    el.scrollLeft = 0;
    return el.querySelector('.page-wrap').getBoundingClientRect().left >= el.getBoundingClientRect().left;
  });
  check('con mucho zoom se llega al borde izquierdo de la página', leftReachable);

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
  const mOverflow = await mp.evaluate(() => {
    if (document.documentElement.scrollWidth <= window.innerWidth) return false;
    const wide = [...document.querySelectorAll('body *')].find((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !el.closest('.viewer, .toolbar, .propbar'));
    return wide ? wide.className || wide.tagName : 'desconocido';
  });
  check('editor sin scroll horizontal en móvil', !mOverflow, String(mOverflow));

  // Táctil: un dedo arrastra el documento; dos dedos pellizcan para ampliar.
  const t = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const tp = await t.newPage();
  tp.on('pageerror', (e) => errors.push(String(e)));
  await tp.goto(`http://localhost:${PORT}/`);
  await tp.setInputFiles('[data-testid="file-input"]', srcPath);
  await tp.waitForSelector('.page-slot');
  await tp.waitForTimeout(800);
  const cdp = await t.newCDPSession(tp);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  const tw0 = await tp.locator('.page-wrap').first().boundingBox();
  await touch('touchStart', [[190, 450]]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [[190, 450 - i * 40]]);
  await touch('touchEnd', []);
  const tScroll = await tp.locator('.viewer').evaluate((el) => el.scrollTop);
  check('un dedo arrastra el documento sin escribir', tScroll > 150 && (await tp.locator('.viewer [data-ann]').count()) === 0, `scrollTop=${tScroll}`);
  await touch('touchStart', [[150, 400]]);
  await touch('touchStart', [[150, 400], [230, 400]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[150 - i * 10, 400], [230 + i * 10, 400]]);
  await touch('touchEnd', []);
  await tp.waitForTimeout(300);
  const tw1 = await tp.locator('.page-wrap').first().boundingBox();
  check('pellizcar con dos dedos amplía', tw1.width > tw0.width * 1.6, `${Math.round(tw0.width)}→${Math.round(tw1.width)}`);
  check('el pellizco no deja marcas en la página', (await tp.locator('.viewer [data-ann], .text-editor').count()) === 0);
  // Un segundo pellizco sigue ampliando, y el lienzo no pasa del tope de píxeles aunque el zoom sea máximo.
  await touch('touchStart', [[170, 400]]);
  await touch('touchStart', [[170, 400], [210, 400]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[170 - i * 12, 400], [210 + i * 12, 400]]);
  await touch('touchEnd', []);
  await tp.waitForTimeout(1200);
  const tw2 = await tp.locator('.page-wrap').first().boundingBox();
  check('un segundo pellizco sigue ampliando', tw2.width > tw1.width * 1.3, `${Math.round(tw1.width)}→${Math.round(tw2.width)}`);
  const maxPx = await tp.locator('.viewer .page-canvas').evaluateAll((cs) => Math.max(...cs.map((c) => c.width * c.height)));
  check('los lienzos no se disparan de tamaño con mucho zoom', maxPx <= 6_050_000, `${(maxPx / 1e6).toFixed(1)} Mpx`);
  const sl0 = await tp.locator('.viewer').evaluate((el) => el.scrollLeft);
  await touch('touchStart', [[150, 400]]);
  await touch('touchStart', [[150, 400], [250, 400]]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [[150 - i * 15, 400], [250 - i * 15, 400]]);
  await touch('touchEnd', []);
  await tp.waitForTimeout(300);
  const sl1 = await tp.locator('.viewer').evaluate((el) => el.scrollLeft);
  check('dos dedos mueven el documento', sl1 > sl0 + 40, `scrollLeft ${sl0}→${sl1}`);
  // Toca dentro de la parte visible de una página (no en el hueco gris entre páginas).
  const [tapX, tapY] = await tp.evaluate(() => {
    const v = document.querySelector('.viewer').getBoundingClientRect();
    for (const w of document.querySelectorAll('.viewer .page-wrap')) {
      const r = w.getBoundingClientRect();
      const top = Math.max(r.top, v.top), bottom = Math.min(r.bottom, v.bottom);
      const left = Math.max(r.left, v.left), right = Math.min(r.right, v.right);
      if (bottom - top > 60 && right - left > 60) return [Math.round((left + right) / 2), Math.round((top + bottom) / 2)];
    }
    return [200, 420];
  });
  await touch('touchStart', [[tapX, tapY]]);
  await touch('touchEnd', []);
  await tp.waitForTimeout(200);
  check('tocar sin arrastrar abre un cuadro de texto', (await tp.locator('.text-editor').count()) === 1);
  // Con letra de menos de 16 px el iPhone amplía la página al escribir.
  const editFont = await tp.locator('.text-editor').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check('el cuadro de texto no provoca el zoom del iPhone', editFont >= 15.99, `${editFont.toFixed(1)} px`);
  await tp.locator('.zoom-value').tap();
  await tp.waitForTimeout(300);
  const twFit = await tp.locator('.page-wrap').first().boundingBox();
  check('tocar el porcentaje vuelve al tamaño de la pantalla', Math.abs(twFit.width - tw0.width) < 2, `ancho ${Math.round(twFit.width)}`);
  check('la página web no se puede ampliar entera mientras se edita', (await tp.locator('meta[name=viewport]').getAttribute('content')).includes('user-scalable=no'));
  await tp.screenshot({ path: join(OUT, 'editor-375-zoom.png') });
  await t.close();

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
