import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { applyTextEdits, type TextEdit } from '../src/lib/contentEdit';
import type { Matrix } from '../src/lib/matrix';

const H = 842;
const VIEW: Matrix = [1, 0, 0, -1, 0, H];

async function contract() {
  const d = await PDFDocument.create();
  d.registerFontkit(fontkit);
  const hel = await d.embedFont(StandardFonts.Helvetica);
  const wide = await d.embedFont(readFileSync('node_modules/@fontsource/dejavu-sans/files/dejavu-sans-latin-400-normal.woff'), { subset: true });
  const p = d.addPage([595, H]);
  p.drawText('Importe total: 12.500,00 euros', { x: 70, y: 690, size: 10, font: hel, color: rgb(0.1, 0.2, 0.6) });
  p.drawText('Y9092530T', { x: 300, y: 720, size: 11, font: wide });
  // Como un PDF ya existente: las fuentes incrustadas se escriben al guardar.
  return { d: await PDFDocument.load(await d.save()), hel };
}

async function items(bytes: Uint8Array) {
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise;
  const tc = await (await pdf.getPage(1)).getTextContent();
  return tc.items.filter((i) => 'str' in i && i.str.trim()) as { str: string; transform: number[]; width: number }[];
}

/** Caja (en puntos de la página vista) de un trozo de una línea de Helvetica 10. */
const box = (hel: { widthOfTextAtSize: (s: string, n: number) => number }, line: string, from: number, to: number, x: number, base: number): TextEdit['box'] => {
  const x0 = x + hel.widthOfTextAtSize(line.slice(0, from), 10);
  const x1 = x + hel.widthOfTextAtSize(line.slice(0, to), 10);
  return { x: x0 - 0.5, y: H - base - 10, w: x1 - x0 + 1, h: 13 };
};

describe('applyTextEdits', () => {
  it('cambia un importe dentro del PDF con la misma fuente y sin mover el resto', async () => {
    const { d, hel } = await contract();
    const line = 'Importe total: 12.500,00 euros';
    const before = await items(await d.save());
    const euros0 = before.find((i) => i.str.includes('euros'))!;
    const out = applyTextEdits(d, d.getPage(0), VIEW, [
      { id: 'c1', box: box(hel, line, 15, 24, 70, 690), oldText: '12.500,00', newText: '98.765,43' },
    ]);
    expect(out.get('c1')).toBe('native');
    const after = await items(await d.save());
    const text = after.map((i) => i.str).join('');
    expect(text).toContain('98.765,43');
    expect(text).not.toContain('12.500,00');
    // «euros» sigue exactamente donde estaba.
    const all = after.map((i) => i.str).join('|');
    expect(all).toContain('euros');
    const lineItem = after.find((i) => i.str.includes('euros'))!;
    const endBefore = euros0.transform[4] + euros0.width;
    expect(Math.abs(lineItem.transform[4] + lineItem.width - endBefore)).toBeLessThan(0.05);
    // Todo con la misma fuente que el original (no se ha añadido ninguna).
    const fonts = d.getPage(0).node.Resources()!.toString();
    expect((fonts.match(/\/Font/g) ?? []).length).toBe(1);
  });

  it('si la fuente incrustada no tiene la letra, quita el original y avisa para escribirlo aparte', async () => {
    const { d } = await contract();
    // El subconjunto de DejaVu solo trae Y 9 0 2 5 3 T: el 4 no está.
    const out = applyTextEdits(d, d.getPage(0), VIEW, [
      { id: 'c2', box: { x: 299, y: H - 720 - 11, w: 80, h: 14 }, oldText: 'Y9092530T', newText: 'Y4092530T' },
    ]);
    expect(out.get('c2')).toBe('removed');
    const after = await items(await d.save());
    expect(after.map((i) => i.str).join('')).not.toContain('Y9092530T');
  });

  it('con letras que ya están en la fuente incrustada, escribe dentro del PDF', async () => {
    const { d } = await contract();
    const out = applyTextEdits(d, d.getPage(0), VIEW, [
      { id: 'c3', box: { x: 299, y: H - 720 - 11, w: 80, h: 14 }, oldText: 'Y9092530T', newText: 'Y2059390T' },
    ]);
    expect(out.get('c3')).toBe('native');
    const after = await items(await d.save());
    expect(after.map((i) => i.str).join('')).toContain('Y2059390T');
  });

  it('no toca nada si en la zona no está el texto esperado', async () => {
    const { d, hel } = await contract();
    const out = applyTextEdits(d, d.getPage(0), VIEW, [
      { id: 'c4', box: box(hel, 'Importe total: 12.500,00 euros', 15, 24, 70, 690), oldText: '99.999,99', newText: '1' },
    ]);
    expect(out.size).toBe(0);
    const after = await items(await d.save());
    expect(after.map((i) => i.str).join('')).toContain('12.500,00');
  });
});
