import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { PDFJS_OPTIONS, getDoc } from './docs';
import { applyTextEdits, handledAnnotations, type TextEdit } from './contentEdit';
import type { Matrix } from './matrix';
import type { Annotation, Page } from '../types';

const sources = new Map<string, Promise<PDFDocument>>();

export interface EditedPage {
  pdf: PDFDocumentProxy;
  /** Anotaciones cuyo cambio ya está dentro de esta página (no hay que pintarlas encima). */
  handled: Set<string>;
}

/**
 * La página con los cambios de texto hechos dentro del PDF, igual que saldrá al descargar.
 * Se pinta en lugar de la original para que lo que se ve sea exactamente lo que se guarda.
 */
export async function editedPage(page: Page, anns: Annotation[], edits: TextEdit[]): Promise<EditedPage | null> {
  if (!edits.length) return null;
  const src = getDoc(page.docId);
  let lib = sources.get(page.docId);
  if (!lib) {
    lib = PDFDocument.load(src.bytes, { ignoreEncryption: true });
    sources.set(page.docId, lib);
  }
  const out = await PDFDocument.create();
  const [copied] = await out.copyPages(await lib, [page.index]);
  const p = out.addPage(copied);
  const vp = (await src.pdf.getPage(page.index + 1)).getViewport({ scale: 1 });
  const outcome = applyTextEdits(out, p, vp.transform as Matrix, edits);
  if (!outcome.size) return null;
  const bytes = await out.save();
  const pdf = await pdfjs.getDocument({ data: bytes, ...PDFJS_OPTIONS }).promise;
  return { pdf, handled: handledAnnotations(anns, outcome) };
}
