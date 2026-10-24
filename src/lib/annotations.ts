import type { Annotation, FontFamily, TextAnn } from '../types';
import { FONTS } from './fonts';

export const FONT_CSS = Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, f.css])) as Record<FontFamily, string>;

export const LINE_HEIGHT = 1.2;
/** Distancia de la parte superior de una línea a su línea base, en múltiplos del cuerpo. */
export const BASELINE = 0.95;
export const NOTE_SIZE = 22;

let measureCtx: CanvasRenderingContext2D | null = null;
export function measureText(t: Pick<TextAnn, 'font' | 'fontSize' | 'bold' | 'italic' | 'scaleX'>, line: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  const sx = t.scaleX ?? 1;
  if (!measureCtx) return line.length * t.fontSize * 0.55 * sx;
  measureCtx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}${t.fontSize}px ${FONT_CSS[t.font]}`;
  return measureCtx.measureText(line).width * sx;
}

/** Altura de la tinta de un texto sobre su línea base (lo que sube la letra más alta). */
export function measureAscent(t: Pick<TextAnn, 'font' | 'fontSize' | 'bold' | 'italic'>, line: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return t.fontSize * 0.72;
  // A 100 px y luego a escala: a tamaños pequeños el navegador redondea la medida a píxeles enteros.
  measureCtx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 'bold ' : ''}100px ${FONT_CSS[t.font]}`;
  return (measureCtx.measureText(line).actualBoundingBoxAscent * t.fontSize) / 100;
}

/** Transformación SVG que estira el texto en horizontal sin moverlo de su x. */
export const stretch = (a: Pick<TextAnn, 'x' | 'scaleX'>) => (a.scaleX && a.scaleX !== 1 ? `matrix(${a.scaleX} 0 0 1 ${a.x * (1 - a.scaleX)} 0)` : undefined);

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function bbox(a: Annotation): Box {
  switch (a.type) {
    case 'text': {
      const lines = a.text.split('\n');
      const w = Math.max(a.fontSize * 0.6, ...lines.map((l) => measureText(a, l)));
      return { x: a.x, y: a.y, w, h: lines.length * a.fontSize * LINE_HEIGHT };
    }
    case 'ink': {
      const xs = a.points.map((p) => p[0]);
      const ys = a.points.map((p) => p[1]);
      const pad = a.width / 2;
      const x = Math.min(...xs) - pad;
      const y = Math.min(...ys) - pad;
      return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
    }
    case 'line':
    case 'arrow':
      return {
        x: Math.min(a.x1, a.x2),
        y: Math.min(a.y1, a.y2),
        w: Math.abs(a.x2 - a.x1),
        h: Math.abs(a.y2 - a.y1),
      };
    case 'note':
      return { x: a.x, y: a.y, w: NOTE_SIZE, h: NOTE_SIZE };
    case 'mark':
      return { x: a.x, y: a.y, w: a.size, h: a.size };
    default:
      return { x: a.x, y: a.y, w: a.w, h: a.h };
  }
}

export function translate(a: Annotation, dx: number, dy: number): Annotation {
  switch (a.type) {
    case 'ink':
      return { ...a, points: a.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
    case 'line':
    case 'arrow':
      return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
    default:
      return { ...a, x: a.x + dx, y: a.y + dy };
  }
}

/** Redimensiona desde la esquina inferior derecha. Devuelve la anotación sin cambios si no admite tamaño. */
export function resizeTo(a: Annotation, start: Annotation, dx: number, dy: number, keepRatio: boolean): Annotation {
  const min = 6;
  switch (start.type) {
    case 'rect':
    case 'ellipse':
    case 'highlight':
    case 'whiteout':
      return { ...start, w: Math.max(min, start.w + dx), h: Math.max(min, start.h + dy) };
    case 'image': {
      let w = Math.max(min, start.w + dx);
      let h = Math.max(min, start.h + dy);
      if (keepRatio) h = (w * start.h) / start.w;
      return { ...start, w, h };
    }
    case 'mark':
      return { ...start, size: Math.max(8, start.size + Math.max(dx, dy)) };
    case 'ink': {
      const b = bbox(start);
      const sx = Math.max(min, b.w + dx) / b.w;
      const sy = keepRatio ? sx : Math.max(min, b.h + dy) / b.h;
      return { ...start, points: start.points.map(([x, y]) => [b.x + (x - b.x) * sx, b.y + (y - b.y) * sy] as [number, number]) };
    }
    case 'text': {
      const b = bbox(start);
      const scale = Math.max(0.2, (b.h + dy) / b.h);
      return { ...start, fontSize: Math.max(4, Math.round(start.fontSize * scale * 2) / 2) };
    }
    default:
      return a;
  }
}

export const canResize = (a: Annotation) => !['note', 'line', 'arrow'].includes(a.type);

/** Trazado SVG (coordenadas con y hacia abajo) del cuerpo de un trazo a mano alzada. */
export function inkPath(points: [number, number][]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M${x} ${y} L${x + 0.01} ${y}`;
  }
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    d += ` Q${x1} ${y1} ${(x1 + x2) / 2} ${(y1 + y2) / 2}`;
  }
  const last = points[points.length - 1];
  return d + ` L${last[0]} ${last[1]}`;
}

/** Punta de flecha como trazado abierto. */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, width: number): string {
  const len = Math.max(8, width * 4);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const a1 = ang + Math.PI - Math.PI / 7;
  const a2 = ang + Math.PI + Math.PI / 7;
  return `M${x2 + len * Math.cos(a1)} ${y2 + len * Math.sin(a1)} L${x2} ${y2} L${x2 + len * Math.cos(a2)} ${y2 + len * Math.sin(a2)}`;
}

export function markPath(kind: 'check' | 'cross', x: number, y: number, s: number): string {
  if (kind === 'check') return `M${x + s * 0.12} ${y + s * 0.55} L${x + s * 0.4} ${y + s * 0.82} L${x + s * 0.9} ${y + s * 0.18}`;
  return `M${x + s * 0.18} ${y + s * 0.18} L${x + s * 0.82} ${y + s * 0.82} M${x + s * 0.82} ${y + s * 0.18} L${x + s * 0.18} ${y + s * 0.82}`;
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
