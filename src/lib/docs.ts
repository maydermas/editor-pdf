import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, PageSizes } from 'pdf-lib';
import { uid } from './id';
import type { Page } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const base = import.meta.env.BASE_URL;
export const PDFJS_OPTIONS = {
  isEvalSupported: false,
  standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
  cMapUrl: `${base}pdfjs/cmaps/`,
  cMapPacked: true,
};

export interface SourceDoc {
  id: string;
  name: string;
  bytes: Uint8Array;
  pdf: PDFDocumentProxy;
}

/** Documentos de origen. Fuera del estado de React porque no son serializables. */
const docs = new Map<string, SourceDoc>();

export const getDoc = (id: string) => {
  const d = docs.get(id);
  if (!d) throw new Error(`Documento ${id} no encontrado`);
  return d;
};

export class LoadError extends Error {}

async function register(name: string, bytes: Uint8Array): Promise<Page[]> {
  let pdf: PDFDocumentProxy;
  try {
    // pdf.js transfiere el búfer al worker: le pasamos una copia.
    pdf = await pdfjs.getDocument({ data: bytes.slice(), ...PDFJS_OPTIONS }).promise;
  } catch (e) {
    const err = e as { name?: string };
    if (err?.name === 'PasswordException') throw new LoadError(`«${name}» está protegido con contraseña.`);
    throw new LoadError(`No se pudo abrir «${name}». ¿Es un PDF válido?`);
  }
  const id = uid('doc');
  docs.set(id, { id, name, bytes, pdf });
  const pages: Page[] = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const p = await pdf.getPage(i + 1);
    const vp = p.getViewport({ scale: 1 });
    pages.push({ id: uid('pg'), docId: id, index: i, width: vp.width, height: vp.height, rotation: 0, annotations: [] });
  }
  return pages;
}

async function imageToPdf(file: File, bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
  const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  // 96 ppp → 72 pt, limitado al ancho de un A4 para fotos grandes.
  let w = img.width * 0.75;
  let h = img.height * 0.75;
  const maxW = PageSizes.A4[0] * 1.5;
  if (w > maxW) {
    h = (h * maxW) / w;
    w = maxW;
  }
  const page = doc.addPage([w, h]);
  page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  return doc.save();
}

export const ACCEPTED = '.pdf,application/pdf,image/png,image/jpeg,.png,.jpg,.jpeg';

export async function loadFile(file: File, maxMB: number): Promise<Page[]> {
  if (file.size > maxMB * 1024 * 1024) throw new LoadError(`«${file.name}» supera el límite de ${maxMB} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isImg = /^image\/(png|jpe?g)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name);
  if (isPdf) return register(file.name, bytes);
  if (isImg) return register(file.name, await imageToPdf(file, bytes));
  throw new LoadError(`«${file.name}»: formato no admitido. Usa PDF, PNG o JPG.`);
}

let blankBytes: Promise<Uint8Array> | null = null;
export async function createBlankPage(): Promise<Page> {
  blankBytes ??= PDFDocument.create().then((d) => {
    d.addPage(PageSizes.A4);
    return d.save();
  });
  const [page] = await register('En blanco', await blankBytes);
  return page;
}
