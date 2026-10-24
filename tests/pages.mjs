// Recorre todas las páginas estáticas: enlaces internos sin errores y sin scroll horizontal en móvil.
// Uso: npm run build && node tests/pages.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4796;
const origin = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res()));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
const seen = new Set();
const queue = ['/'];
const problems = [];
while (queue.length) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  const res = await page.goto(origin + path);
  if (!res || res.status() !== 200) {
    problems.push(`${path}: HTTP ${res?.status()}`);
    continue;
  }
  if (path !== '/' && !(await page.locator('h1').count())) problems.push(`${path}: sin h1`);
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) problems.push(`${path}: scroll horizontal en móvil`);
  const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
  for (const href of links) {
    const u = new URL(href);
    if (u.origin === origin && !u.hash && !seen.has(u.pathname)) queue.push(u.pathname);
  }
}
await browser.close();
server.kill();
console.log(`${seen.size} páginas revisadas`);
problems.forEach((p) => console.log('FALLO', p));
process.exit(problems.length ? 1 : 0);
