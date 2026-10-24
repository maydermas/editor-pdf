import * as pdfjs from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { getDoc } from './docs';
import type { FontFamily, Page } from '../types';
import { detectFont } from './fonts';

/** Una línea (o trozo de línea) de texto que ya trae el PDF, en puntos de la página tal como se ve. */
export interface TextRun {
  key: string;
  text: string;
  x: number;
  baseline: number;
  width: number;
  fontSize: number;
  font: FontFamily;
  bold: boolean;
  italic: boolean;
}

const cache = new Map<string, Promise<TextRun[]>>();

/**
 * Lee el texto de una página con pdf.js y une los trozos contiguos de la misma
 * línea y estilo, para que al pulsar se edite una frase entera y no letra a letra.
 */
export function getTextRuns(page: Page): Promise<TextRun[]> {
  const key = `${page.docId}:${page.index}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const pdfPage = await getDoc(page.docId).pdf.getPage(page.index + 1);
      const vp = pdfPage.getViewport({ scale: 1 });
      const content = await pdfPage.getTextContent();
      // Cargar las fuentes para conocer su nombre real (p. ej. «Times-Bold»), que dice si es negrita o cursiva.
      await pdfPage.getOperatorList().catch(() => null);
      const fontInfo = (id: string) => {
        try {
          const f = pdfPage.commonObjs.get(id) as { name?: string; bold?: boolean; black?: boolean; italic?: boolean } | null;
          return f ?? {};
        } catch {
          return {};
        }
      };
      const pieces: (TextRun & { fontName: string; end: number })[] = [];
      for (const raw of content.items) {
        const item = raw as TextItem;
        if (!('str' in item) || !item.str.trim()) continue;
        const tx = pdfjs.Util.transform(vp.transform, item.transform);
        // Solo texto horizontal (respecto a cómo se ve la página).
        if (Math.abs(tx[1]) > 0.01 || tx[0] <= 0) continue;
        const fontSize = Math.hypot(tx[2], tx[3]);
        if (fontSize < 2) continue;
        const width = item.width;
        const style = content.styles[item.fontName];
        const info = fontInfo(item.fontName);
        const guessed = detectFont(`${info.name ?? ''} ${item.fontName}`, style?.fontFamily ?? '');
        pieces.push({
          key: '',
          text: item.str,
          x: tx[4],
          baseline: tx[5],
          width,
          fontSize,
          fontName: item.fontName,
          end: tx[4] + width,
          ...guessed,
          bold: guessed.bold || !!info.bold || !!info.black,
          italic: guessed.italic || !!info.italic,
        });
      }
      pieces.sort((a, b) => a.baseline - b.baseline || a.x - b.x);
      const runs: typeof pieces = [];
      for (const piece of pieces) {
        const last = runs[runs.length - 1];
        const sameLine = last && Math.abs(last.baseline - piece.baseline) < last.fontSize * 0.25;
        const gap = last ? piece.x - last.end : 0;
        if (last && sameLine && last.fontName === piece.fontName && Math.abs(last.fontSize - piece.fontSize) < 0.5 && gap > -last.fontSize * 0.3 && gap < last.fontSize * 0.9) {
          last.text += gap > last.fontSize * 0.15 && !last.text.endsWith(' ') && !piece.text.startsWith(' ') ? ' ' + piece.text : piece.text;
          last.end = piece.end;
          last.width = last.end - last.x;
        } else {
          runs.push({ ...piece });
        }
      }
      return runs.map(({ fontName: _f, end: _e, ...r }, i) => ({ ...r, text: r.text.replace(/\s+$/, ''), key: `${key}:${i}` }));
    })();
    cache.set(key, p);
  }
  return p;
}

/** Caja que cubre un texto existente (con un pequeño margen para tapar del todo las letras). */
export function runBox(r: TextRun, others: TextRun[] = []) {
  const pad = Math.max(0.6, r.fontSize * 0.06);
  let top = r.baseline - r.fontSize * 0.92 - pad;
  let bottom = r.baseline + r.fontSize * 0.26 + pad;
  // Con interlineado justo, la caja no debe comerse las letras de la línea de arriba ni la de abajo.
  for (const o of others) {
    if (o === r || o.x > r.x + r.width || o.x + o.width < r.x) continue;
    if (o.baseline > r.baseline + r.fontSize * 0.5) bottom = Math.min(bottom, o.baseline - o.fontSize * 0.78);
    else if (o.baseline < r.baseline - r.fontSize * 0.5) top = Math.max(top, o.baseline + o.fontSize * 0.22);
  }
  return { x: r.x - pad, y: top, w: r.width + pad * 2, h: Math.max(r.fontSize * 0.9, bottom - top) };
}

/**
 * Toma del lienzo ya pintado el color de fondo (el más repetido en el borde de la caja)
 * y el del texto (el que más contrasta con el fondo dentro de la caja).
 */
const rasters = new Map<string, Promise<HTMLCanvasElement>>();
const ready = new Map<string, HTMLCanvasElement>();
/** La copia pintada si ya está lista (para no esperar y no perder el gesto del usuario en móviles). */
export const pageRasterReady = (page: Page) => ready.get(`${page.docId}:${page.index}`) ?? null;
/** Página pintada aparte a 2× para leer colores, aunque aún no se vea en pantalla. */
export function pageRaster(page: Page): Promise<HTMLCanvasElement> {
  const key = `${page.docId}:${page.index}`;
  let p = rasters.get(key);
  if (!p) {
    p = (async () => {
      const pdfPage = await getDoc(page.docId).pdf.getPage(page.index + 1);
      const vp = pdfPage.getViewport({ scale: 2 });
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width);
      c.height = Math.ceil(vp.height);
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise;
      ready.set(key, c);
      return c;
    })();
    rasters.set(key, p);
  }
  return p;
}

export function sampleColors(canvas: HTMLCanvasElement, page: Page, box: { x: number; y: number; w: number; h: number }) {
  const fallback = { bg: '#ffffff', fg: '#111111' };
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !canvas.width) return fallback;
  const sx = canvas.width / page.width;
  const sy = canvas.height / page.height;
  const x0 = Math.max(0, Math.floor(box.x * sx));
  const y0 = Math.max(0, Math.floor(box.y * sy));
  const w = Math.min(canvas.width - x0, Math.ceil(box.w * sx));
  const h = Math.min(canvas.height - y0, Math.ceil(box.h * sy));
  if (w < 2 || h < 2) return fallback;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(x0, y0, w, h).data;
  } catch {
    return fallback;
  }
  const px = (i: number) => [data[i], data[i + 1], data[i + 2]] as const;
  // Agrupa los colores del borde y se queda con la media del grupo más numeroso.
  const counts = new Map<string, { n: number; sum: [number, number, number] }>();
  const edge = (x: number, y: number) => {
    const [r, g, b] = px((y * w + x) * 4);
    const k = `${r >> 3},${g >> 3},${b >> 3}`;
    const c = counts.get(k) ?? { n: 0, sum: [0, 0, 0] };
    c.n++;
    c.sum[0] += r;
    c.sum[1] += g;
    c.sum[2] += b;
    counts.set(k, c);
  };
  for (let x = 0; x < w; x++) {
    edge(x, 0);
    edge(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    edge(0, y);
    edge(w - 1, y);
  }
  const winner = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  const top = winner.sum.map((v) => Math.round(v / winner.n));
  let best = 0;
  let fg = [17, 17, 17];
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.abs(data[i] - top[0]) + Math.abs(data[i + 1] - top[1]) + Math.abs(data[i + 2] - top[2]);
    if (d > best) {
      best = d;
      fg = [data[i], data[i + 1], data[i + 2]];
    }
  }
  const hex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  // Un fondo casi blanco se deja en blanco puro para que no se note el parche.
  const bg = top.every((v) => v > 240) ? '#ffffff' : hex(top);
  return { bg, fg: best < 60 ? fallback.fg : hex(fg) };
}
