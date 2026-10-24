// Comprueba que la app es instalable y funciona sin conexión. Uso: npm run build && node tests/pwa.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4795;
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${name}${detail ? ' — ' + detail : ''}`);
};
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res());
  setTimeout(() => rej(new Error('vite preview no arrancó')), 20000);
});
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]').href;
    return (await fetch(href)).json();
  });
  check('manifest con nombre, iconos 192/512 y modo standalone', manifest.display === 'standalone' && manifest.icons.some((i) => i.sizes === '512x512') && manifest.icons.some((i) => i.sizes === '192x192'));
  const cdp = await ctx.newCDPSession(page);
  const errs = await cdp.send('Page.getInstallabilityErrors');
  check('Chrome la considera instalable', errs.installabilityErrors.length === 0, JSON.stringify(errs.installabilityErrors));
  await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 15000 });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  check('service worker activo', true);
  await ctx.setOffline(true);
  await page.reload();
  check('portada carga sin conexión', await page.getByRole('heading', { level: 1 }).isVisible());
  await page.setInputFiles('[data-testid="file-input"]', process.argv[2]);
  await page.waitForSelector('.page-slot canvas', { timeout: 15000 });
  await page.waitForTimeout(1000);
  const painted = await page.evaluate(() => document.querySelector('.page-slot canvas').width > 0);
  check('abre y pinta un PDF sin conexión', painted);
} catch (e) {
  check('ejecución sin excepciones', false, String(e));
} finally {
  await browser.close();
  server.kill();
}
process.exit(results.every(Boolean) ? 0 : 1);
