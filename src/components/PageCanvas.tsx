import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { getDoc } from '../lib/docs';
import type { Page } from '../types';

const MAX_CANVAS_PIXELS = 6_000_000;

/**
 * Pinta una página con pdf.js. Solo renderiza cuando está cerca de la vista,
 * y vuelve a pintar (con un pequeño retardo) cuando cambia la escala.
 */
export function PageCanvas({
  page,
  scale,
  source,
  onRendered,
}: {
  page: Page;
  scale: number;
  /** Página ya editada (un PDF de una sola página) que se pinta en lugar de la original. */
  source?: PDFDocumentProxy | null;
  onRendered?: (source: PDFDocumentProxy | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) {
      // Fuera de la vista se suelta la imagen: el iPhone tiene un tope de memoria para todos los lienzos juntos
      // y, si se pasa, los deja en blanco.
      const c = canvasRef.current;
      if (c && c.width > 1) {
        c.width = 1;
        c.height = 1;
      }
      return;
    }
    let task: RenderTask | null = null;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const pdfPage = source ? await source.getPage(1) : await getDoc(page.docId).pdf.getPage(page.index + 1);
        if (cancelled || !canvasRef.current) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        // Tope de píxeles: un lienzo enorme con mucho zoom agota la memoria del móvil (y Safari lo deja en blanco).
        const base = pdfPage.getViewport({ scale: 1 });
        const maxScale = Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height));
        const vp = pdfPage.getViewport({ scale: Math.min(scale * dpr, maxScale) });
        const off = document.createElement('canvas');
        off.width = Math.ceil(vp.width);
        off.height = Math.ceil(vp.height);
        task = pdfPage.render({ canvasContext: off.getContext('2d')!, viewport: vp });
        await task.promise;
        if (cancelled || !canvasRef.current) return;
        const c = canvasRef.current;
        c.width = off.width;
        c.height = off.height;
        c.getContext('2d')!.drawImage(off, 0, 0);
        off.width = 0;
        off.height = 0;
        onRendered?.(source ?? null);
      } catch (e) {
        if ((e as { name?: string })?.name !== 'RenderingCancelledException' && !cancelled) setError(true);
      }
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [visible, scale, page.docId, page.index, source]);

  return (
    <>
      <canvas ref={canvasRef} className="page-canvas" />
      {error && <div className="page-error">No se pudo mostrar esta página</div>}
    </>
  );
}
