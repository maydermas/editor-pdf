import type { FontFamily } from '../types';

/**
 * Tipografías disponibles. Las tres primeras son las estándar de PDF (no hace falta incrustarlas);
 * el resto son fuentes libres (OFL/Apache) que se descargan solo cuando se usan. Cuando el PDF
 * usa una fuente comercial (Calibri, Cambria, Georgia…), se elige su equivalente libre con las
 * mismas medidas o el aspecto más parecido.
 */
export interface FontDef {
  label: string;
  /** Familia CSS con alternativas del sistema mientras se descarga la nuestra. */
  css: string;
  /** Nombre del paquete de @fontsource; sin él es una fuente estándar de PDF. */
  file?: string;
  /** Nombres de fuente (en minúsculas) que se reconocen como esta familia. */
  match: RegExp;
}

export const FONTS: Record<FontFamily, FontDef> = {
  helvetica: { label: 'Helvetica / Arial', css: 'Helvetica, Arial, sans-serif', match: /helvetica|arial|liberationsans|arimo|nimbussans/ },
  times: { label: 'Times New Roman', css: '"Times New Roman", Times, serif', match: /times|tinos|liberationserif|nimbusrom/ },
  courier: { label: 'Courier', css: '"Courier New", Courier, monospace', match: /courier|cousine|liberationmono|nimbusmon|mono|consol/ },
  calibri: { label: 'Calibri', css: '"EPDF Carlito", Calibri, Carlito, sans-serif', file: 'carlito', match: /calibri|carlito/ },
  cambria: { label: 'Cambria', css: '"EPDF Caladea", Cambria, Caladea, serif', file: 'caladea', match: /cambria|caladea/ },
  georgia: { label: 'Georgia', css: '"EPDF Gelasio", Georgia, Gelasio, serif', file: 'gelasio', match: /georgia|gelasio/ },
  garamond: { label: 'Garamond', css: '"EPDF EB Garamond", Garamond, "EB Garamond", serif', file: 'eb-garamond', match: /garamond/ },
  roboto: { label: 'Roboto', css: '"EPDF Roboto", Roboto, sans-serif', file: 'roboto', match: /roboto/ },
  opensans: { label: 'Open Sans', css: '"EPDF Open Sans", "Open Sans", sans-serif', file: 'open-sans', match: /opensans|open sans/ },
  lato: { label: 'Lato', css: '"EPDF Lato", Lato, sans-serif', file: 'lato', match: /\blato|lato-|lato,/ },
  montserrat: { label: 'Montserrat', css: '"EPDF Montserrat", Montserrat, sans-serif', file: 'montserrat', match: /montserrat/ },
  poppins: { label: 'Poppins', css: '"EPDF Poppins", Poppins, sans-serif', file: 'poppins', match: /poppins/ },
};

export const FONT_ORDER = Object.keys(FONTS) as FontFamily[];

const STYLES = [
  ['400', 'normal'],
  ['700', 'normal'],
  ['400', 'italic'],
  ['700', 'italic'],
] as const;

/** Ruta del archivo de una variante; las fuentes se copian a public/fonts al compilar. */
export const fontUrl = (file: string, bold: boolean, italic: boolean) =>
  `${import.meta.env.BASE_URL}fonts/${file}-latin-${bold ? 700 : 400}-${italic ? 'italic' : 'normal'}.woff`;

/** Adivina la familia a partir del nombre que trae el PDF (p. ej. «ABCDEF+Calibri-Bold»). */
export function detectFont(name: string, generic = ''): { font: FontFamily; bold: boolean; italic: boolean } {
  const n = name.toLowerCase().replace(/\b[a-z]{6}\+/g, '');
  const g = generic.toLowerCase();
  const font =
    FONT_ORDER.find((k) => FONTS[k].file && FONTS[k].match.test(n)) ??
    FONT_ORDER.find((k) => !FONTS[k].file && FONTS[k].match.test(n)) ??
    (/roman|book|minion|palatino|baskerville|bodoni|serif/.test(n) && !/sans/.test(n)
      ? 'times'
      : g === 'monospace'
        ? 'courier'
        : g === 'serif'
          ? 'times'
          : 'helvetica');
  return { font, bold: /bold|black|heavy|semibold|demi/.test(n), italic: /italic|oblique/.test(n) };
}

const loading = new Map<FontFamily, Promise<void>>();

/** Descarga y registra las cuatro variantes de una familia para verla en pantalla. */
export function loadFont(font: FontFamily): Promise<void> {
  const def = FONTS[font];
  if (!def.file || typeof FontFace === 'undefined') return Promise.resolve();
  let p = loading.get(font);
  if (!p) {
    const family = def.css.split(',')[0].replace(/"/g, '');
    p = Promise.all(
      STYLES.map(async ([weight, style]) => {
        const face = new FontFace(family, `url(${fontUrl(def.file!, weight === '700', style === 'italic')})`, { weight, style });
        document.fonts.add(await face.load());
      }),
    ).then(
      () => undefined,
      (e) => console.warn('No se pudo cargar la fuente', font, e),
    );
    loading.set(font, p);
  }
  return p;
}
