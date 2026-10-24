import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFPage, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream } from 'pdf-lib';
import { Encodings, Font as StdFont, FontNames } from '@pdf-lib/standard-fonts';
import fontkit from '@pdf-lib/fontkit';
import { apply, compose, type Matrix } from './matrix';
import type { Annotation, TextAnn } from '../types';

/**
 * Edición del texto dentro del propio PDF (como hacen los editores de escritorio): en lugar de tapar
 * la palabra con un parche y escribir encima con una letra parecida, se quitan sus letras del
 * contenido de la página y se escriben las nuevas con la misma fuente, tamaño, color y espaciado
 * del original. Si algo no cuadra (texto dentro de un formulario XObject, fuente sin las letras
 * necesarias, texto invisible de un escaneo…) se informa y el llamante usa el parche de siempre.
 */
export interface TextEdit {
  id: string;
  /** Zona de la página (puntos, tal como se ve, y hacia abajo) cuyas letras se sustituyen. */
  box: { x: number; y: number; w: number; h: number };
  /** Lo que había en esa zona (para comprobar que se quitan exactamente esas letras). */
  oldText: string;
  /** Texto nuevo de una sola línea; vacío si solo se borra. null: quitar sin escribir nada. */
  newText: string | null;
}

/** native: quitado y reescrito con la fuente original. removed: solo quitado (se escribe aparte). */
export type EditOutcome = 'native' | 'removed';

// ---------------------------------------------------------------------------------------------
// Lectura del contenido de la página

type Operand = number | boolean | null | { name: string } | { str: Uint8Array } | Operand[] | { dict: true };
interface Op {
  op: string;
  args: Operand[];
  start: number;
  end: number;
}

const isWhite = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
const isDelim = (c: number) => c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37;

function parseOps(b: Uint8Array): Op[] {
  const ops: Op[] = [];
  let i = 0;
  const n = b.length;
  const skip = () => {
    while (i < n) {
      if (isWhite(b[i])) i++;
      else if (b[i] === 37) while (i < n && b[i] !== 10 && b[i] !== 13) i++;
      else break;
    }
  };
  const literal = (): Uint8Array => {
    const out: number[] = [];
    let depth = 1;
    i++;
    while (i < n) {
      const c = b[i++];
      if (c === 92) {
        const e = b[i++];
        if (e === 110) out.push(10);
        else if (e === 114) out.push(13);
        else if (e === 116) out.push(9);
        else if (e === 98) out.push(8);
        else if (e === 102) out.push(12);
        else if (e === 13) { if (b[i] === 10) i++; }
        else if (e === 10) { /* continuación de línea */ }
        else if (e >= 48 && e <= 55) {
          let v = e - 48;
          for (let k = 0; k < 2 && b[i] >= 48 && b[i] <= 55; k++) v = v * 8 + (b[i++] - 48);
          out.push(v & 255);
        } else out.push(e);
      } else if (c === 40) {
        depth++;
        out.push(c);
      } else if (c === 41) {
        if (--depth === 0) break;
        out.push(c);
      } else out.push(c);
    }
    return Uint8Array.from(out);
  };
  const hex = (): Uint8Array => {
    i++;
    let s = '';
    while (i < n && b[i] !== 62) {
      if (!isWhite(b[i])) s += String.fromCharCode(b[i]);
      i++;
    }
    i++;
    if (s.length % 2) s += '0';
    const out = new Uint8Array(s.length / 2);
    for (let k = 0; k < out.length; k++) out[k] = parseInt(s.substr(k * 2, 2), 16) || 0;
    return out;
  };
  const word = () => {
    const s = i;
    while (i < n && !isWhite(b[i]) && !isDelim(b[i])) i++;
    return String.fromCharCode(...b.subarray(s, i));
  };
  const value = (): Operand | undefined => {
    skip();
    const c = b[i];
    if (c === 40) return { str: literal() };
    if (c === 60 && b[i + 1] === 60) {
      // Diccionario (propiedades de contenido marcado): no hace falta su valor.
      let depth = 0;
      while (i < n) {
        if (b[i] === 60 && b[i + 1] === 60) { depth++; i += 2; }
        else if (b[i] === 62 && b[i + 1] === 62) { depth--; i += 2; if (!depth) break; }
        else if (b[i] === 40) literal();
        else i++;
      }
      return { dict: true };
    }
    if (c === 60) return { str: hex() };
    if (c === 47) {
      i++;
      return { name: word() };
    }
    if (c === 91) {
      i++;
      const arr: Operand[] = [];
      for (;;) {
        skip();
        if (i >= n) break;
        if (b[i] === 93) { i++; break; }
        const v = value();
        if (v === undefined) {
          // Palabra suelta dentro de un array: se ignora.
          word() || i++;
          continue;
        }
        arr.push(v);
      }
      return arr;
    }
    if ((c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46) {
      const w = word();
      const v = Number(w);
      return Number.isFinite(v) ? v : 0;
    }
    return undefined;
  };

  let args: Operand[] = [];
  let argStart = -1;
  while (i < n) {
    skip();
    if (i >= n) break;
    const at = i;
    const v = value();
    if (v !== undefined) {
      if (argStart < 0) argStart = at;
      args.push(v);
      continue;
    }
    if (i === at) {
      const w = word();
      if (!w) {
        i++;
        continue;
      }
      if (w === 'true' || w === 'false' || w === 'null') {
        if (argStart < 0) argStart = at;
        args.push(w === 'true' ? true : w === 'false' ? false : null);
        continue;
      }
      const start = argStart < 0 ? at : argStart;
      if (w === 'BI') {
        // Imagen en línea: sus datos binarios llegan hasta «EI».
        let j = i;
        while (j < n - 1 && !(b[j] === 73 && b[j + 1] === 68 && isWhite(b[j - 1] ?? 32) && (j + 2 >= n || isWhite(b[j + 2])))) j++;
        j += 3;
        while (j < n - 1 && !(isWhite(b[j - 1]) && b[j] === 69 && b[j + 1] === 73 && (j + 2 >= n || isWhite(b[j + 2]) || isDelim(b[j + 2])))) j++;
        i = Math.min(n, j + 2);
        ops.push({ op: 'BI', args: [], start, end: i });
      } else {
        ops.push({ op: w, args, start, end: i });
      }
      args = [];
      argStart = -1;
    }
  }
  return ops;
}

// ---------------------------------------------------------------------------------------------
// Fuentes: anchos, códigos y qué letras se pueden escribir

const WIN_ANSI_TO_UNICODE = new Map<number, string>();
const NAME_TO_UNICODE = new Map<string, string>();
for (const cp of Encodings.WinAnsi.supportedCodePoints) {
  const { code, name } = Encodings.WinAnsi.encodeUnicodeCodePoint(cp);
  if (!WIN_ANSI_TO_UNICODE.has(code)) WIN_ANSI_TO_UNICODE.set(code, String.fromCodePoint(cp));
  NAME_TO_UNICODE.set(name, String.fromCodePoint(cp));
}
const STANDARD_14 = new Set<string>(Object.values(FontNames));
const STD_ALIASES: Record<string, string> = {
  Arial: 'Helvetica',
  'Arial-Bold': 'Helvetica-Bold',
  'Arial,Bold': 'Helvetica-Bold',
  'Arial-BoldMT': 'Helvetica-Bold',
  ArialMT: 'Helvetica',
  'Arial-ItalicMT': 'Helvetica-Oblique',
  'Arial-BoldItalicMT': 'Helvetica-BoldOblique',
  TimesNewRoman: 'Times-Roman',
  TimesNewRomanPSMT: 'Times-Roman',
  'TimesNewRoman,Bold': 'Times-Bold',
  'TimesNewRomanPS-BoldMT': 'Times-Bold',
  CourierNew: 'Courier',
  CourierNewPSMT: 'Courier',
};

interface FontInfo {
  ok: boolean;
  twoByte: boolean;
  /** Ancho (milésimas de cuerpo) de un código. */
  width: (code: number) => number;
  /** Texto de un código, para comparar y para saber qué letras ya trae la página. */
  toUni: (code: number) => string;
  /** Código con el que se escribe una letra, o null si la fuente no la tiene. */
  encode: (ch: string) => number | null;
  /** Letras ya vistas en la página con esta fuente: seguro que la fuente las tiene. */
  seen: Map<string, number>;
}

const num = (v: unknown, d = 0) => (v instanceof PDFNumber ? v.asNumber() : d);
const nameOf = (v: unknown) => (v instanceof PDFName ? v.decodeText() : '');

function streamBytes(s: unknown): Uint8Array | null {
  try {
    if (s instanceof PDFRawStream) return decodePDFRawStream(s).decode();
    const any = s as { getUnencodedContents?: () => Uint8Array };
    return any?.getUnencodedContents?.() ?? null;
  } catch {
    return null;
  }
}

function parseToUnicode(bytes: Uint8Array): Map<number, string> {
  const map = new Map<number, string>();
  const text = new TextDecoder('latin1').decode(bytes);
  const utf16 = (h: string) => {
    const units: number[] = [];
    for (let k = 0; k + 4 <= h.length; k += 4) units.push(parseInt(h.substr(k, 4), 16));
    if (h.length === 2) units.push(parseInt(h, 16));
    return String.fromCharCode(...units);
  };
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(m[1], 16), utf16(m[2]));
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (hi - lo > 65535) continue;
      if (m[3].startsWith('[')) {
        const list = [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => utf16(x[1]));
        list.forEach((u, k) => map.set(lo + k, u));
      } else {
        const h = m[3].slice(1, -1);
        const base = utf16(h);
        const last = base.charCodeAt(base.length - 1);
        for (let c = lo; c <= hi; c++) map.set(c, base.slice(0, -1) + String.fromCharCode(last + (c - lo)));
      }
    }
  }
  return map;
}

function loadFontInfo(dict: PDFDict): FontInfo {
  const bad: FontInfo = { ok: false, twoByte: false, width: () => 0, toUni: () => '', encode: () => null, seen: new Map() };
  const subtype = nameOf(dict.get(PDFName.of('Subtype')));
  const toUnicode = (() => {
    const s = dict.lookup(PDFName.of('ToUnicode'));
    const bytes = s instanceof PDFStream ? streamBytes(s) : null;
    return bytes ? parseToUnicode(bytes) : null;
  })();
  const seen = new Map<string, number>();

  if (subtype === 'Type0') {
    if (nameOf(dict.get(PDFName.of('Encoding'))) !== 'Identity-H') return bad;
    const desc = dict.lookup(PDFName.of('DescendantFonts'), PDFArray).lookup(0, PDFDict);
    const dw = num(desc.lookup(PDFName.of('DW')), 1000);
    const widths = new Map<number, number>();
    const W = desc.lookup(PDFName.of('W'));
    if (W instanceof PDFArray) {
      for (let k = 0; k < W.size(); ) {
        const first = num(W.lookup(k));
        const next = W.lookup(k + 1);
        if (next instanceof PDFArray) {
          for (let j = 0; j < next.size(); j++) widths.set(first + j, num(next.lookup(j)));
          k += 2;
        } else {
          const last = num(next);
          const w = num(W.lookup(k + 2));
          for (let c = first; c <= last && c - first < 65536; c++) widths.set(c, w);
          k += 3;
        }
      }
    }
    // Letras nuevas: solo si la fuente incrustada es TrueType con CID = glifo y el glifo tiene dibujo.
    const fd = desc.lookup(PDFName.of('FontDescriptor'));
    const ff2 = fd instanceof PDFDict ? fd.lookup(PDFName.of('FontFile2')) : undefined;
    const cidToGid = desc.get(PDFName.of('CIDToGIDMap'));
    let program: ReturnType<typeof fontkit.create> | null = null;
    if (ff2 instanceof PDFStream && (!cidToGid || nameOf(cidToGid) === 'Identity')) {
      try {
        const bytes = streamBytes(ff2);
        program = bytes ? fontkit.create(bytes) : null;
      } catch {
        program = null;
      }
    }
    const info: FontInfo = {
      ok: true,
      twoByte: true,
      width: (c) => widths.get(c) ?? dw,
      toUni: (c) => toUnicode?.get(c) ?? '',
      seen,
      encode: (ch) => {
        const known = seen.get(ch);
        if (known !== undefined) return known;
        if (!program) return null;
        try {
          const g = program.glyphForCodePoint(ch.codePointAt(0)!);
          if (!g || !g.id || (ch.trim() && !g.path.toSVG())) return null;
          if (!widths.has(g.id)) {
            // Se apunta el ancho del glifo nuevo para que los lectores lo coloquen bien.
            const w = Math.round((g.advanceWidth * 1000) / program.unitsPerEm);
            const arr = W instanceof PDFArray ? W : dict.context.obj([]);
            if (!(W instanceof PDFArray)) desc.set(PDFName.of('W'), arr);
            (arr as PDFArray).push(PDFNumber.of(g.id));
            (arr as PDFArray).push(dict.context.obj([w]));
            widths.set(g.id, w);
          }
          return g.id;
        } catch {
          return null;
        }
      },
    };
    return info;
  }

  if (subtype !== 'Type1' && subtype !== 'TrueType' && subtype !== 'MMType1') return bad;
  const base = nameOf(dict.get(PDFName.of('BaseFont'))).replace(/^[A-Z]{6}\+/, '');
  const fd = dict.lookup(PDFName.of('FontDescriptor'));
  const embedded =
    fd instanceof PDFDict && !!(fd.get(PDFName.of('FontFile')) || fd.get(PDFName.of('FontFile2')) || fd.get(PDFName.of('FontFile3')));
  const stdName = STANDARD_14.has(base) ? base : STD_ALIASES[base];
  const afm = !embedded && stdName ? StdFont.load(stdName as FontNames) : null;

  // Código → letra: por ToUnicode o por la codificación (WinAnsi y sus «Differences»).
  const codeToUni = new Map<number, string>();
  const enc = dict.lookup(PDFName.of('Encoding'));
  const encName = enc instanceof PDFName ? enc.decodeText() : enc instanceof PDFDict ? nameOf(enc.get(PDFName.of('BaseEncoding'))) : '';
  const symbolic = stdName === 'Symbol' || stdName === 'ZapfDingbats';
  if (!symbolic) {
    for (const [c, u] of WIN_ANSI_TO_UNICODE) {
      // Sin WinAnsi declarada, solo se fían los ASCII (iguales en StandardEncoding).
      if (encName === 'WinAnsiEncoding' || (c >= 32 && c < 127 && c !== 39 && c !== 96)) codeToUni.set(c, u);
    }
  }
  if (enc instanceof PDFDict) {
    const diff = enc.lookup(PDFName.of('Differences'));
    if (diff instanceof PDFArray) {
      let code = 0;
      for (let k = 0; k < diff.size(); k++) {
        const v = diff.lookup(k);
        if (v instanceof PDFNumber) code = v.asNumber();
        else if (v instanceof PDFName) {
          const g = v.decodeText();
          const u = NAME_TO_UNICODE.get(g) ?? (/^uni([0-9A-F]{4})$/.test(g) ? String.fromCharCode(parseInt(g.slice(3), 16)) : undefined);
          if (u) codeToUni.set(code, u);
          else codeToUni.delete(code);
          code++;
        }
      }
    }
  }
  if (toUnicode) for (const [c, u] of toUnicode) codeToUni.set(c, u);
  const uniToCode = new Map<string, number>();
  for (const [c, u] of codeToUni) if (!uniToCode.has(u)) uniToCode.set(u, c);

  const first = num(dict.lookup(PDFName.of('FirstChar')), 0);
  const ws = dict.lookup(PDFName.of('Widths'));
  const missing = fd instanceof PDFDict ? num(fd.lookup(PDFName.of('MissingWidth')), 0) : 0;
  const width = (c: number) => {
    if (ws instanceof PDFArray && c >= first && c - first < ws.size()) return num(ws.lookup(c - first));
    if (afm) {
      const glyph = Encodings.WinAnsi.canEncodeUnicodeCodePoint(codeToUni.get(c)?.codePointAt(0) ?? -1)
        ? Encodings.WinAnsi.encodeUnicodeCodePoint(codeToUni.get(c)!.codePointAt(0)!).name
        : '';
      return (glyph && afm.getWidthOfGlyph(glyph)) || missing;
    }
    return missing;
  };
  if (!(ws instanceof PDFArray) && !afm) return bad;
  // TrueType incrustada: una letra que no sale en la página vale si su glifo tiene dibujo.
  let program: ReturnType<typeof fontkit.create> | null = null;
  const ff2 = fd instanceof PDFDict ? fd.lookup(PDFName.of('FontFile2')) : undefined;
  if (ff2 instanceof PDFStream && !symbolic) {
    try {
      const bytes = streamBytes(ff2);
      program = bytes ? fontkit.create(bytes) : null;
    } catch {
      program = null;
    }
  }
  const fromProgram = (ch: string): number | null => {
    const c = uniToCode.get(ch);
    if (!program || c === undefined || !(ws instanceof PDFArray) || c < first || c - first >= ws.size()) return null;
    try {
      const g = program.glyphForCodePoint(ch.codePointAt(0)!);
      if (!g || !g.id || (ch.trim() && !g.path.toSVG())) return null;
      if (width(c) <= 0) ws.set(c - first, PDFNumber.of(Math.round((g.advanceWidth * 1000) / program.unitsPerEm)));
      return c;
    } catch {
      return null;
    }
  };
  return {
    ok: true,
    twoByte: false,
    width,
    toUni: (c) => codeToUni.get(c) ?? '',
    seen,
    encode: (ch) => {
      const known = seen.get(ch);
      if (known !== undefined) return known;
      // Fuente no incrustada (Helvetica, Arial, Times…): el lector la pone y tiene todas las letras WinAnsi.
      if (!embedded && !symbolic) {
        const c = uniToCode.get(ch);
        return c !== undefined && width(c) > 0 ? c : null;
      }
      return fromProgram(ch);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Recorrido del texto de la página

interface Glyph {
  op: number;
  /** Elemento del array de TJ (0 para Tj, ' y "). */
  el: number;
  /** Posición del primer byte del código dentro de la cadena. */
  at: number;
  len: number;
  code: number;
  uni: string;
  /** Avance en el espacio del texto (lo que se mueve la matriz del texto tras la letra). */
  adv: number;
  /** Centro de la letra y su línea base, en la página tal como se ve. */
  cx: number;
  by: number;
  font: string;
  size: number;
  th: number;
  tc: number;
  tw: number;
  tr: number;
  inForm: boolean;
}

interface GState {
  ctm: Matrix;
  font: string;
  size: number;
  tc: number;
  tw: number;
  th: number;
  tl: number;
  tr: number;
}

const ID: Matrix = [1, 0, 0, 1, 0, 0];

function contentBytes(page: PDFPage): Uint8Array | null {
  const c = page.node.Contents();
  if (!c) return new Uint8Array();
  const parts: Uint8Array[] = [];
  const list = c instanceof PDFArray ? Array.from({ length: c.size() }, (_, k) => c.lookup(k)) : [c];
  for (const s of list) {
    const b = streamBytes(s);
    if (!b) return null;
    parts.push(b);
  }
  const total = parts.reduce((t, p) => t + p.length + 1, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
    out[o++] = 10;
  }
  return out;
}

function fontDictOf(page: PDFPage, name: string): PDFDict | null {
  const res = page.node.Resources();
  const fonts = res?.lookup(PDFName.of('Font'));
  if (!(fonts instanceof PDFDict)) return null;
  const f = fonts.lookup(PDFName.of(name));
  return f instanceof PDFDict ? f : null;
}

const fmt = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? '0' : String(r);
};
const hexOf = (bytes: number[]) => '<' + bytes.map((x) => x.toString(16).padStart(2, '0')).join('') + '>';

/**
 * Aplica las ediciones sobre la página (ya copiada en el documento de salida) y devuelve qué se pudo
 * hacer con cada una. `view` es la transformación de pdf.js a escala 1 (PDF → página como se ve).
 */
export function applyTextEdits(doc: PDFDocument, page: PDFPage, view: Matrix, edits: TextEdit[]): Map<string, EditOutcome> {
  const result = new Map<string, EditOutcome>();
  if (!edits.length) return result;
  const bytes = contentBytes(page);
  if (!bytes) return result;
  const ops = parseOps(bytes);

  const fonts = new Map<string, FontInfo>();
  const fontInfo = (name: string) => {
    let f = fonts.get(name);
    if (!f) {
      const d = fontDictOf(page, name);
      try {
        f = d ? loadFontInfo(d) : undefined;
      } catch {
        f = undefined;
      }
      f ??= { ok: false, twoByte: false, width: () => 0, toUni: () => '', encode: () => null, seen: new Map() };
      fonts.set(name, f);
    }
    return f;
  };

  // 1. Recorre todas las letras con su posición.
  const glyphs: Glyph[] = [];
  let gs: GState = { ctm: ID, font: '', size: 0, tc: 0, tw: 0, th: 1, tl: 0, tr: 0 };
  const stack: GState[] = [];
  let tm: Matrix = ID;
  let tlm: Matrix = ID;
  let formDepth = 0;
  const show = (opIndex: number, el: number, str: Uint8Array) => {
    const f = fontInfo(gs.font);
    if (!f.ok) {
      // Fuente que no sabemos medir: las letras siguientes de la línea quedarían mal situadas.
      tm = compose(tm, [1, 0, 0, 1, NaN, 0]);
      return;
    }
    const step = f.twoByte ? 2 : 1;
    for (let k = 0; k + step <= str.length; k += step) {
      const code = f.twoByte ? (str[k] << 8) | str[k + 1] : str[k];
      const w0 = f.width(code) / 1000;
      const space = !f.twoByte && code === 32;
      const adv = (w0 * gs.size + gs.tc + (space ? gs.tw : 0)) * gs.th;
      const m = compose(gs.ctm, tm);
      const [ox, oy] = apply(view, ...apply(m, 0, 0));
      const [ex, ey] = apply(view, ...apply(m, w0 * gs.size * gs.th, 0));
      const uni = f.toUni(code);
      if (uni && Math.abs(ey - oy) < 0.01 + Math.abs(ex - ox) * 0.02 && ex >= ox && !f.seen.has(uni)) f.seen.set(uni, code);
      glyphs.push({
        op: opIndex,
        el,
        at: k,
        len: step,
        code,
        uni,
        adv,
        cx: (ox + ex) / 2,
        by: oy,
        font: gs.font,
        size: gs.size,
        th: gs.th,
        tc: gs.tc,
        tw: gs.tw,
        tr: gs.tr,
        inForm: formDepth > 0,
      });
      tm = compose(tm, [1, 0, 0, 1, adv, 0]);
    }
  };
  const nums = (o: Op) => o.args.map((a) => (typeof a === 'number' ? a : 0));
  ops.forEach((o, idx) => {
    const a = nums(o);
    switch (o.op) {
      case 'q':
        stack.push({ ...gs });
        break;
      case 'Q':
        gs = stack.pop() ?? gs;
        break;
      case 'cm':
        gs = { ...gs, ctm: compose(gs.ctm, a.slice(0, 6) as Matrix) };
        break;
      case 'BT':
        tm = tlm = ID;
        break;
      case 'Tf': {
        const n = o.args[0];
        gs = { ...gs, font: n && typeof n === 'object' && 'name' in n ? n.name : '', size: a[1] };
        break;
      }
      case 'Tc':
        gs = { ...gs, tc: a[0] };
        break;
      case 'Tw':
        gs = { ...gs, tw: a[0] };
        break;
      case 'Tz':
        gs = { ...gs, th: a[0] / 100 };
        break;
      case 'TL':
        gs = { ...gs, tl: a[0] };
        break;
      case 'Tr':
        gs = { ...gs, tr: a[0] };
        break;
      case 'Td':
        tm = tlm = compose(tlm, [1, 0, 0, 1, a[0], a[1]]);
        break;
      case 'TD':
        gs = { ...gs, tl: -a[1] };
        tm = tlm = compose(tlm, [1, 0, 0, 1, a[0], a[1]]);
        break;
      case 'Tm':
        tm = tlm = a.slice(0, 6) as Matrix;
        break;
      case 'T*':
        tm = tlm = compose(tlm, [1, 0, 0, 1, 0, -gs.tl]);
        break;
      case 'Tj':
        if (o.args[0] && typeof o.args[0] === 'object' && 'str' in o.args[0]) show(idx, 0, o.args[0].str);
        break;
      case "'":
      case '"': {
        if (o.op === '"') gs = { ...gs, tw: a[0], tc: a[1] };
        tm = tlm = compose(tlm, [1, 0, 0, 1, 0, -gs.tl]);
        const s = o.args[o.args.length - 1];
        if (s && typeof s === 'object' && 'str' in s) show(idx, 0, s.str);
        break;
      }
      case 'TJ': {
        const arr = o.args[0];
        if (!Array.isArray(arr)) break;
        arr.forEach((e, el) => {
          if (typeof e === 'number') tm = compose(tm, [1, 0, 0, 1, (-e / 1000) * gs.size * gs.th, 0]);
          else if (e && typeof e === 'object' && 'str' in e) show(idx, el, e.str);
        });
        break;
      }
      case 'Do':
        // El texto dentro de formularios XObject no se toca (sus letras no aparecen aquí).
        break;
    }
  });

  // 2. Qué letras quita cada edición y si se puede escribir el texto nuevo con la misma fuente.
  const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, '');
  const removeSet = new Set<Glyph>();
  const inserts = new Map<Glyph, number[]>(); // letra delante de la que se escribe → códigos
  for (const e of edits) {
    const pad = 0.01;
    const hit = glyphs.filter(
      (g) => g.cx >= e.box.x - pad && g.cx <= e.box.x + e.box.w + pad && g.by >= e.box.y - pad && g.by <= e.box.y + e.box.h + pad,
    );
    const visible = hit.filter((g) => g.uni.trim());
    if (!visible.length || hit.some((g) => g.inForm || !Number.isFinite(g.cx) || !(g.size * g.th))) continue;
    if (norm(visible.map((g) => g.uni).join('')) !== norm(e.oldText)) continue;
    // Texto invisible (capa de un escaneo) o con trazo/recorte: mejor el parche de siempre.
    if (visible.some((g) => g.tr !== 0)) continue;
    hit.forEach((g) => removeSet.add(g));
    let outcome: EditOutcome = 'removed';
    const anchor = visible[0];
    const text = e.newText ?? '';
    if (e.newText !== null && !text.includes('\n') && visible.every((g) => g.font === anchor.font && g.size === anchor.size)) {
      const f = fontInfo(anchor.font);
      const codes: number[] = [];
      for (const ch of text) {
        const c = f.encode(ch);
        if (c === null) {
          codes.length = 0;
          break;
        }
        codes.push(c);
      }
      if (codes.length === [...text].length && anchor.size && anchor.th) {
        inserts.set(anchor, codes);
        outcome = 'native';
      }
    }
    result.set(e.id, outcome);
  }
  if (!removeSet.size) return result;

  // 3. Reescribe solo las órdenes de texto afectadas: las letras quitadas se cambian por un hueco
  //    del mismo ancho (así lo demás no se mueve) y el texto nuevo va donde empezaba el antiguo.
  const byOp = new Map<number, Glyph[]>();
  for (const g of glyphs) {
    if (!byOp.has(g.op)) byOp.set(g.op, []);
    byOp.get(g.op)!.push(g);
  }
  const replacements = new Map<number, string>();
  for (const [opIdx, list] of byOp) {
    if (!list.some((g) => removeSet.has(g))) continue;
    const o = ops[opIdx];
    const parts: string[] = [];
    let gap = 0; // en espacio del texto
    let codesRun: number[] = [];
    const g0 = list[0];
    const f = fontInfo(g0.font);
    const step = f.twoByte ? 2 : 1;
    const flushStr = () => {
      if (codesRun.length) parts.push(hexOf(codesRun));
      codesRun = [];
    };
    const flushGap = () => {
      if (Math.abs(gap) > 1e-9) {
        flushStr();
        parts.push(fmt((-gap * 1000) / (g0.size * g0.th)));
      }
      gap = 0;
    };
    const pushCode = (c: number) => {
      if (step === 2) codesRun.push((c >> 8) & 255, c & 255);
      else codesRun.push(c & 255);
    };
    const elems: Operand[] = o.op === 'TJ' ? (o.args[0] as Operand[]) : [o.args[o.args.length - 1]];
    elems.forEach((e, el) => {
      if (typeof e === 'number') {
        flushGap();
        flushStr();
        parts.push(fmt(e));
        return;
      }
      if (!e || typeof e !== 'object' || !('str' in e)) return;
      for (const g of list.filter((x) => x.el === el)) {
        const ins = inserts.get(g);
        if (ins) {
          flushGap();
          for (const c of ins) {
            pushCode(c);
            const w0 = f.width(c) / 1000;
            gap -= (w0 * g.size + g.tc + (!f.twoByte && c === 32 ? g.tw : 0)) * g.th;
          }
        }
        if (removeSet.has(g)) {
          gap += g.adv;
          continue;
        }
        flushGap();
        pushCode(g.code);
      }
    });
    flushGap();
    flushStr();
    let prefix = '';
    if (o.op === "'") prefix = 'T* ';
    if (o.op === '"') prefix = `${fmt(nums(o)[0])} Tw ${fmt(nums(o)[1])} Tc T* `;
    replacements.set(opIdx, `${prefix}[${parts.join(' ')}] TJ`);
  }

  // 4. Une el contenido nuevo: lo no tocado se copia byte a byte.
  const chunks: Uint8Array[] = [];
  let pos = 0;
  const enc = new TextEncoder();
  [...replacements.keys()]
    .sort((x, y) => x - y)
    .forEach((idx) => {
      const o = ops[idx];
      chunks.push(bytes.subarray(pos, o.start), enc.encode(replacements.get(idx)!));
      pos = o.end;
    });
  chunks.push(bytes.subarray(pos));
  const size = chunks.reduce((t, c) => t + c.length, 0);
  const out = new Uint8Array(size);
  let o2 = 0;
  for (const c of chunks) {
    out.set(c, o2);
    o2 += c.length;
  }
  const stream = doc.context.flateStream(out);
  page.node.set(PDFName.of('Contents'), doc.context.register(stream) as PDFRef);
  return result;
}

// ---------------------------------------------------------------------------------------------
// Ediciones a partir de las anotaciones de una página

/** Huella del texto tal como quedó al editar la línea: si luego se mueve o se cambia el estilo, ya no se escribe dentro del PDF. */
export const textSig = (t: TextAnn) => JSON.stringify([t.x, t.y, t.fontSize, t.font, t.bold, t.italic, t.color, t.text, t.scaleX ?? 1]);

/** Parches de edición de texto de la página que se pueden aplicar dentro del PDF. */
export function textEditsOf(anns: Annotation[], skipTextId: string | null = null): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const a of anns) {
    if (a.type !== 'whiteout' || !a.sourceKey || a.oldText === undefined) continue;
    const t = anns.find((x): x is TextAnn => x.type === 'text' && x.coverId === a.id);
    if (t && t.id === skipTextId) continue;
    edits.push({
      id: a.id,
      box: { x: a.x, y: a.y, w: a.w, h: a.h },
      oldText: a.oldText,
      newText: !t ? '' : a.textSig === textSig(t) ? t.text : null,
    });
  }
  return edits;
}

/** Anotaciones que ya no hay que pintar porque su cambio está hecho dentro del PDF. */
export function handledAnnotations(anns: Annotation[], outcome: Map<string, EditOutcome>): Set<string> {
  const ids = new Set<string>();
  for (const [coverId, how] of outcome) {
    ids.add(coverId);
    if (how === 'native') {
      const t = anns.find((x) => x.type === 'text' && x.coverId === coverId);
      if (t) ids.add(t.id);
    }
  }
  return ids;
}
