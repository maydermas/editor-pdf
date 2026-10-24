import {
  BlendMode,
  LineCapStyle,
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFPage,
  StandardFonts,
  concatTransformationMatrix,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import { zipSync } from 'fflate';
import { PDFJS_OPTIONS, getDoc } from './docs';
import { BASELINE, LINE_HEIGHT, NOTE_SIZE, arrowHead, inkPath, markPath } from './annotations';
import { apply, displayUpToPdf, type Matrix } from './matrix';
import { FONTS, fontUrl } from './fonts';
import fontkit from '@pdf-lib/fontkit';
import type { Annotation, ExportFormat, FontFamily, Page, TextAnn } from '../types';

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const FONT_KEYS: Partial<Record<FontFamily, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]>> = {
  helvetica: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
  times: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  courier: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
};

class FontCache {
  private cache = new Map<string, Promise<PDFFont>>();
  constructor(private doc: PDFDocument) {}
  get(t: TextAnn) {
    const std = FONT_KEYS[t.font];
    const file = FONTS[t.font].file;
    const key = std ? std[(t.bold ? 1 : 0) + (t.italic ? 2 : 0)] : `${t.font}-${t.bold}-${t.italic}`;
    let f = this.cache.get(key);
    if (!f) {
      f = std
        ? this.doc.embedFont(std[(t.bold ? 1 : 0) + (t.italic ? 2 : 0)])
        : (async () => {
            // Fuentes libres: se incrustan solo las letras usadas.
            this.doc.registerFontkit(fontkit);
            const res = await fetch(fontUrl(file!, t.bold, t.italic));
            if (!res.ok) return this.doc.embedFont(StandardFonts.Helvetica);
            return this.doc.embedFont(new Uint8Array(await res.arrayBuffer()), { subset: true });
          })();
      this.cache.set(key, f);
    }
    return f;
  }
}

/** Las fuentes estándar solo cubren WinAnsi: cambia lo que no se pueda codificar por «?». */
function encodable(font: PDFFont, s: string) {
  let out = '';
  for (const ch of s) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

async function drawAnnotation(doc: PDFDocument, page: PDFPage, a: Annotation, h: number, fonts: FontCache, m: Matrix) {
  // Dentro de este bloque se dibuja en "pantalla con y hacia arriba": la y de pantalla es h - y.
  switch (a.type) {
    case 'text': {
      const font = await fonts.get(a);
      a.text.split('\n').forEach((line, i) => {
        if (!line) return;
        const baseline = a.y + a.fontSize * (BASELINE + i * LINE_HEIGHT);
        page.drawText(encodable(font, line), { x: a.x, y: h - baseline, size: a.fontSize, font, color: hexToRgb(a.color) });
      });
      break;
    }
    case 'ink':
      page.drawSvgPath(inkPath(a.points), {
        x: 0,
        y: h,
        borderColor: hexToRgb(a.color),
        borderWidth: a.width,
        borderLineCap: LineCapStyle.Round,
      });
      break;
    case 'highlight':
      page.drawRectangle({ x: a.x, y: h - a.y - a.h, width: a.w, height: a.h, color: hexToRgb(a.color), opacity: 0.4, blendMode: BlendMode.Multiply });
      break;
    case 'whiteout':
      page.drawRectangle({ x: a.x, y: h - a.y - a.h, width: a.w, height: a.h, color: a.color ? hexToRgb(a.color) : rgb(1, 1, 1) });
      break;
    case 'rect':
      page.drawRectangle({ x: a.x, y: h - a.y - a.h, width: a.w, height: a.h, borderColor: hexToRgb(a.color), borderWidth: a.width });
      break;
    case 'ellipse':
      page.drawEllipse({ x: a.x + a.w / 2, y: h - a.y - a.h / 2, xScale: a.w / 2, yScale: a.h / 2, borderColor: hexToRgb(a.color), borderWidth: a.width });
      break;
    case 'line':
    case 'arrow': {
      let d = `M${a.x1} ${a.y1} L${a.x2} ${a.y2}`;
      if (a.type === 'arrow') d += ' ' + arrowHead(a.x1, a.y1, a.x2, a.y2, a.width);
      page.drawSvgPath(d, { x: 0, y: h, borderColor: hexToRgb(a.color), borderWidth: a.width, borderLineCap: LineCapStyle.Round });
      break;
    }
    case 'mark':
      if (a.kind === 'dot') {
        page.drawCircle({ x: a.x + a.size / 2, y: h - a.y - a.size / 2, size: a.size * 0.3, color: hexToRgb(a.color) });
      } else {
        page.drawSvgPath(markPath(a.kind, a.x, a.y, a.size), {
          x: 0,
          y: h,
          borderColor: hexToRgb(a.color),
          borderWidth: Math.max(1.5, a.size / 9),
          borderLineCap: LineCapStyle.Round,
        });
      }
      break;
    case 'image': {
      const bytes = Uint8Array.from(atob(a.src.split(',')[1]), (c) => c.charCodeAt(0));
      const img = a.src.startsWith('data:image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      page.drawImage(img, { x: a.x, y: h - a.y - a.h, width: a.w, height: a.h });
      break;
    }
    case 'note': {
      // Nota adhesiva real (anotación /Text), visible como comentario en cualquier lector.
      const corners = [
        [a.x, h - a.y],
        [a.x + NOTE_SIZE, h - a.y],
        [a.x, h - a.y - NOTE_SIZE],
        [a.x + NOTE_SIZE, h - a.y - NOTE_SIZE],
      ].map(([x, y]) => apply(m, x, y));
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const c = hexToRgb(a.color);
      const annot = doc.context.obj({
        Type: 'Annot',
        Subtype: 'Text',
        Rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        Contents: PDFHexString.fromText(a.text),
        C: [c.red, c.green, c.blue],
        Name: 'Comment',
        F: 4,
      });
      page.node.addAnnot(doc.context.register(annot));
      break;
    }
  }
}

/** Genera el PDF editado con las páginas indicadas (índices del documento en edición). */
export async function buildPdf(pages: Page[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const fonts = new FontCache(out);
  const sources = new Map<string, PDFDocument>();

  for (const p of pages) {
    const src = getDoc(p.docId);
    let lib = sources.get(p.docId);
    if (!lib) {
      lib = await PDFDocument.load(src.bytes, { ignoreEncryption: true });
      sources.set(p.docId, lib);
    }
    const [copied] = await out.copyPages(lib, [p.index]);
    const page = out.addPage(copied);
    const jsPage = await src.pdf.getPage(p.index + 1);
    const vp = jsPage.getViewport({ scale: 1 });
    page.setRotation(degrees((jsPage.rotate + p.rotation) % 360));

    const drawable = p.annotations.filter((a) => a.type !== 'note' || a.text.trim());
    if (!drawable.length) continue;

    // Aísla el contenido original para que su estado gráfico no afecte a lo que añadimos.
    const ctx = out.context;
    page.node.wrapContentStreams(ctx.getPushGraphicsStateContentStream(), ctx.getPopGraphicsStateContentStream());

    const m = displayUpToPdf(vp.transform as Matrix, p.height);
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m));
    for (const a of drawable.filter((a) => a.type !== 'note')) await drawAnnotation(out, page, a, p.height, fonts, m);
    page.pushOperators(popGraphicsState());
    for (const a of drawable.filter((a) => a.type === 'note')) await drawAnnotation(out, page, a, p.height, fonts, m);
  }
  out.setProducer('Editor PDF');
  out.setCreator('Editor PDF');
  return out.save({ useObjectStreams: true });
}

async function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo generar la imagen'))), type, quality));
}

/** Rasteriza cada página de un PDF ya generado. */
async function rasterize(pdfBytes: Uint8Array, scale: number, type: 'image/png' | 'image/jpeg', quality: number, onPage?: (i: number, n: number) => void) {
  const pdf = await pdfjs.getDocument({ data: pdfBytes.slice(), ...PDFJS_OPTIONS }).promise;
  const result: { blob: Blob; width: number; height: number }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    onPage?.(i, pdf.numPages);
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, annotationMode: pdfjs.AnnotationMode.ENABLE }).promise;
    result.push({ blob: await canvasBlob(canvas, type, quality), width: vp.width / scale, height: vp.height / scale });
  }
  await pdf.destroy();
  return result;
}

export interface ExportOptions {
  format: ExportFormat;
  groups: number[][];
  split: boolean;
  fileName: string;
  quality: number; // 0.3–0.95, solo para formatos con JPEG
  onProgress?: (msg: string) => void;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
}

const stripExt = (s: string) => s.replace(/\.[a-z0-9]+$/i, '') || 'documento';

export async function exportDocument(all: Page[], o: ExportOptions): Promise<ExportResult> {
  const base = stripExt(o.fileName);
  const files: { name: string; data: Uint8Array }[] = [];
  const groups = o.split ? o.groups : [o.groups.flat()];

  for (let g = 0; g < groups.length; g++) {
    const suffix = groups.length > 1 ? `-${g + 1}` : '';
    o.onProgress?.(groups.length > 1 ? `Generando archivo ${g + 1} de ${groups.length}…` : 'Aplicando cambios…');
    const pdf = await buildPdf(groups[g].map((i) => all[i]));

    if (o.format === 'pdf') {
      files.push({ name: `${base}${suffix}.pdf`, data: pdf });
    } else if (o.format === 'pdf-compressed') {
      const imgs = await rasterize(pdf, 1 + o.quality, 'image/jpeg', o.quality, (i, n) => o.onProgress?.(`Comprimiendo página ${i} de ${n}…`));
      const out = await PDFDocument.create();
      for (const img of imgs) {
        const jpg = await out.embedJpg(new Uint8Array(await img.blob.arrayBuffer()));
        out.addPage([img.width, img.height]).drawImage(jpg, { x: 0, y: 0, width: img.width, height: img.height });
      }
      files.push({ name: `${base}${suffix}.pdf`, data: await out.save({ useObjectStreams: true }) });
    } else {
      const type = o.format === 'png' ? 'image/png' : 'image/jpeg';
      const imgs = await rasterize(pdf, 2, type, o.quality, (i, n) => o.onProgress?.(`Convirtiendo página ${i} de ${n}…`));
      for (let i = 0; i < imgs.length; i++) {
        const name = imgs.length === 1 && groups.length === 1 ? `${base}.${o.format}` : `${base}${suffix}-p${i + 1}.${o.format}`;
        files.push({ name, data: new Uint8Array(await imgs[i].blob.arrayBuffer()) });
      }
    }
  }

  if (files.length === 1) {
    const f = files[0];
    const mime = f.name.endsWith('.pdf') ? 'application/pdf' : f.name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return { blob: new Blob([f.data], { type: mime }), fileName: f.name };
  }
  o.onProgress?.('Empaquetando ZIP…');
  const zip = zipSync(Object.fromEntries(files.map((f) => [f.name, [f.data, { level: 0 }]])));
  return { blob: new Blob([zip], { type: 'application/zip' }), fileName: `${base}.zip` };
}

export function downloadBlob(r: ExportResult) {
  const url = URL.createObjectURL(r.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = r.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
