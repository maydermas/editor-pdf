import { describe, expect, it } from 'vitest';
import { parsePageRanges } from '../src/lib/pageRange';
import { apply, compose, displayUpToPdf, invert, type Matrix } from '../src/lib/matrix';

describe('parsePageRanges', () => {
  it('vacío = todas las páginas', () => {
    expect(parsePageRanges('', 3)).toEqual({ groups: [[0, 1, 2]] });
  });
  it('rangos con comas y espacios', () => {
    expect(parsePageRanges('1-3,5 7', 8)).toEqual({ groups: [[0, 1, 2], [4], [6]] });
  });
  it('rango inverso', () => {
    expect(parsePageRanges('3-1', 3)).toEqual({ groups: [[2, 1, 0]] });
  });
  it('fuera de rango y texto inválido', () => {
    expect(parsePageRanges('9', 3)).toHaveProperty('error');
    expect(parsePageRanges('a-b', 3)).toHaveProperty('error');
    expect(parsePageRanges('0', 3)).toHaveProperty('error');
  });
});

describe('matrices', () => {
  it('invertir y componer da la identidad', () => {
    const m: Matrix = [0, 1, -1, 0, 30, 40];
    const id = compose(m, invert(m));
    id.forEach((v, i) => expect(v).toBeCloseTo([1, 0, 0, 1, 0, 0][i]));
  });
  it('página sin rotar: pantalla-arriba coincide con PDF', () => {
    // pdf.js para una página 600×800 sin rotar: [1,0,0,-1,0,800]
    const m = displayUpToPdf([1, 0, 0, -1, 0, 800], 800);
    expect(apply(m, 10, 20)).toEqual([10, 20]);
  });
  it('página con /Rotate 90: la esquina visible superior izquierda va a (0,0) del PDF', () => {
    // pdf.js para 600×800 con rotación 90: [0,1,1,0,0,0]; vista de 800×600
    const m = displayUpToPdf([0, 1, 1, 0, 0, 0], 600);
    const [x, y] = apply(m, 0, 600); // arriba a la izquierda en pantalla-arriba
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });
});

describe('detectFont', async () => {
  const { detectFont } = await import('../src/lib/fonts');
  it('reconoce fuentes comerciales y elige su equivalente libre', () => {
    expect(detectFont('ABCDEF+Calibri-Bold')).toEqual({ font: 'calibri', bold: true, italic: false });
    expect(detectFont('Cambria-Italic')).toEqual({ font: 'cambria', bold: false, italic: true });
    expect(detectFont('ArialMT')).toMatchObject({ font: 'helvetica' });
    expect(detectFont('TimesNewRomanPS-BoldMT')).toEqual({ font: 'times', bold: true, italic: false });
    expect(detectFont('Montserrat-SemiBold')).toMatchObject({ font: 'montserrat', bold: true });
    expect(detectFont('g_d0_f3', 'monospace')).toMatchObject({ font: 'courier' });
  });
  it('sin pistas usa sans o serif según el tipo genérico', () => {
    expect(detectFont('g_d0_f1', 'serif')).toMatchObject({ font: 'times' });
    expect(detectFont('g_d0_f1', 'sans-serif')).toMatchObject({ font: 'helvetica' });
  });
});
