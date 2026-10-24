// Copia las fuentes estándar y los CMaps de pdf.js a public/ para que el visor
// pinte bien los PDF con fuentes no incrustadas o texto CJK.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
for (const dir of ['standard_fonts', 'cmaps']) {
  cpSync(`node_modules/pdfjs-dist/${dir}`, `public/pdfjs/${dir}`, { recursive: true });
}

// Tipografías libres para editar texto con una letra parecida a la del PDF (ver src/lib/fonts.ts).
// Solo el alfabeto latino, en pesos 400 y 700, normal y cursiva.
mkdirSync('public/fonts', { recursive: true });
for (const pkg of ['carlito', 'caladea', 'gelasio', 'eb-garamond', 'roboto', 'open-sans', 'lato', 'montserrat', 'poppins', 'dejavu-sans']) {
  const dir = `node_modules/@fontsource/${pkg}/files`;
  for (const f of readdirSync(dir)) {
    if (/^[a-z-]+-latin-(400|700)-(normal|italic)\.woff$/.test(f)) cpSync(`${dir}/${f}`, `public/fonts/${f}`);
  }
}
