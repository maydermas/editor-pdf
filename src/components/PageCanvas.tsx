import { useEffect, useRef, useState } from 'react';
import type { RenderTask } from 'pdfjs-dist';
import { getDoc } from '../lib/docs';
import type { Page } from '../types';

/**
 * Pinta una página con pdf.js. Solo renderiza cuando está cerca de la vista,
 * y vuelve a pintar (con un pequeño retardo) cuando cambia la escala.
 */
export function PageCanvas({ page, scale }: { page: Page; scale: number }) {
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
    if (!visible) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const pdfPage = await getDoc(page.docId).pdf.getPage(page.index + 1);
        if (cancelled || !canvasRef.current) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = pdfPage.getViewport({ scale: scale * dpr });
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
      } catch (e) {
        if ((e as { name?: string })?.name !== 'RenderingCancelledException' && !cancelled) setError(true);
      }
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [visible, scale, page.docId, page.index]);

  return (
    <>
      <canvas ref={canvasRef} className="page-canvas" />
      {error && <div className="page-error">No se pudo mostrar esta página</div>}
    </>
  );
}
