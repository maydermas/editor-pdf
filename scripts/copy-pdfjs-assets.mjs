// Copia las fuentes estándar y los CMaps de pdf.js a public/ para que el visor
// pinte bien los PDF con fuentes no incrustadas o texto CJK.
import { cpSync } from 'node:fs';
for (const dir of ['standard_fonts', 'cmaps']) {
  cpSync(`node_modules/pdfjs-dist/${dir}`, `public/pdfjs/${dir}`, { recursive: true });
}
