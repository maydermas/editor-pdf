// Comprueba que se detecta la tipografía de un PDF (Calibri → Carlito) y que se respeta al exportar.
// Uso: npm run build && node tests/fonts.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const OUT = process.env.OUT_DIR || '/tmp/editor-pdf-fonts';
mkdirSync(OUT, { recursive: true });
const PORT = 4793;
let fails = 0;
const check = (name, ok, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${name}${detail ? ' — ' + detail : ''}`);
};

// Documento escrito con Carlito en negrita (mismas medidas que Calibri).
const src = await PDFDocument.create();
src.registerFontkit(fontkit);
const carlitoBold = await src.embedFont(readFileSync('node_modules/@fontsource/carlito/files/carlito-latin-700-normal.woff'), { subset: true });
const pg = src.addPage([595, 842]);
pg.drawText('Presupuesto de reforma', { x: 60, y: 760, size: 22, font: carlitoBold });
pg.drawText('Presupuesto de reforma', { x: 60, y: 700, size: 22, font: carlitoBold });
const srcPath = join(OUT, 'calibri.pdf');
writeFileSync(srcPath, await src.save());

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res()));
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.setInputFiles('[data-testid="file-input"]', srcPath);
  await page.waitForSelector('.viewer .text-run');
  await page.waitForTimeout(500);

  const fontSelect = page.locator('.propbar select').last();
  check('la letra por defecto pasa a ser la del documento', (await fontSelect.inputValue()) === 'calibri', await fontSelect.inputValue());

  // Abrir líneas sin cambiar nada no debe tocar el documento.
  await page.locator('.viewer .text-run').nth(1).click();
  await page.waitForSelector('.text-editor');
  await page.locator('.viewer .text-run').nth(0).click();
  await page.mouse.click(700, 700);
  await page.waitForTimeout(300);
  check('abrir líneas sin cambiarlas no modifica el documento', (await page.locator('.viewer [data-ann]').count()) === 0, `${await page.locator('.viewer [data-ann]').count()} elementos`);

  await page.locator('.viewer .text-run').first().click();
  await page.waitForSelector('.text-editor');
  const ff = await page.locator('.text-editor').evaluate((el) => `${getComputedStyle(el).fontFamily} ${getComputedStyle(el).fontWeight}`);
  check('al editar se usa la misma tipografía y grosor', /Carlito/.test(ff) && /700/.test(ff), ff);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Presupuesto final');
  await page.mouse.click(700, 700);
  await page.waitForTimeout(300);
  check('la fuente libre se descarga y se aplica en pantalla', await page.evaluate(() => document.fonts.check('bold 20px "EPDF Carlito"')));

  await page.getByRole('button', { name: /Listo/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Descargar 1 página/ }).click()]);
  const outPath = join(OUT, 'salida.pdf');
  await download.saveAs(outPath);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(outPath)), isEvalSupported: false, fontExtraProperties: true }).promise;
  const p1 = await doc.getPage(1);
  const tc = await p1.getTextContent();
  const item = tc.items.find((i) => i.str.includes('final'));
  check('el PDF exportado contiene el texto nuevo', !!item, tc.items.map((i) => i.str).join(' | '));
  await p1.getOperatorList();
  const fontName = item ? p1.commonObjs.get(item.fontName)?.name ?? '' : '';
  check('el texto nuevo va con Carlito incrustada', /Carlito/i.test(fontName), fontName);
} finally {
  await browser.close();
  server.kill();
}
console.log(fails ? `${fails} fallos` : 'Todo correcto');
process.exit(fails ? 1 : 0);
