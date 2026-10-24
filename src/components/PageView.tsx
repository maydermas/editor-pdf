import { useEffect, useRef, useState } from 'react';
import type { Annotation, BoxAnn, Page, TextAnn, Tool, ToolStyle } from '../types';
import { PageCanvas } from './PageCanvas';
import { AnnotationShape } from './AnnotationSvg';
import { BASELINE, FONT_CSS, LINE_HEIGHT, bbox, canResize, measureAscent, measureText, resizeTo, today, translate } from '../lib/annotations';
import { charX, fitScale, getTextRuns, inkAscent, pageRaster, pageRasterReady, runBox, sampleColors, type TextRun } from '../lib/textRuns';
import { uid } from '../lib/id';
import { fontReady, loadFont } from '../lib/fonts';
import { textEditsOf, textSig } from '../lib/contentEdit';
import { editedPage, type EditedPage } from '../lib/preview';
import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface Stamp {
  src: string;
  w: number;
  h: number;
  signature: boolean;
}

export interface PageApi {
  tool: Tool;
  style: ToolStyle;
  zoom: number;
  selected: { pageId: string; annId: string } | null;
  editingId: string | null;
  stamp: Stamp | null;
  select: (pageId: string, annId: string | null) => void;
  setEditing: (annId: string | null) => void;
  checkpoint: () => void;
  /** Cambia las anotaciones de una página; `record` guarda un paso de deshacer. */
  update: (pageId: string, fn: (anns: Annotation[]) => Annotation[], record: boolean) => void;
  onStampPlaced: () => void;
  undo: () => void;
  /** Cancela el gesto en curso de una página (lo usa el visor al detectar dos dedos). */
  gestureAbort: { current: (() => void) | null };
}

type Gesture =
  | { kind: 'move'; id: string; x0: number; y0: number; start: Annotation; started: boolean }
  | { kind: 'resize'; id: string; x0: number; y0: number; start: Annotation; started: boolean }
  | { kind: 'endpoint'; id: string; end: 1 | 2; start: Annotation; started: boolean }
  | { kind: 'create'; id: string; x0: number; y0: number }
  // Herramientas de «tocar para colocar»: si se arrastra, se mueve el documento en lugar de colocar.
  | { kind: 'tap'; cx: number; cy: number; x: number; y: number; runKey: string | null; panning: boolean; sl: number; st: number };

/** Herramientas que actúan al soltar sin arrastrar; arrastrar con ellas desplaza el documento. */
const TAP_TOOLS: Tool[] = ['select', 'text', 'date', 'note', 'check', 'cross', 'dot', 'stamp'];
const PAN_THRESHOLD = 6;

const BOX_TOOLS: Tool[] = ['highlight', 'whiteout', 'rect', 'ellipse'];
const DEFAULT_BOX: Record<string, [number, number]> = {
  highlight: [140, 18],
  whiteout: [120, 24],
  rect: [120, 70],
  ellipse: [100, 70],
};

export function PageView({ page, number, api }: { page: Page; number: number; api: PageApi }) {
  const { zoom, tool, style } = api;
  const wrapRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const swapped = page.rotation % 180 !== 0;
  const outerW = (swapped ? page.height : page.width) * zoom;
  const outerH = (swapped ? page.width : page.height) * zoom;
  const innerW = page.width * zoom;
  const innerH = page.height * zoom;

  // Texto que ya trae el PDF: se carga al elegir la herramienta Texto.
  const [runs, setRuns] = useState<TextRun[]>([]);
  useEffect(() => {
    if (tool !== 'text') return;
    let alive = true;
    getTextRuns(page)
      .then((r) => {
        if (alive) setRuns(r);
        if (r.length) pageRaster(page).catch(() => null);
        // Las letras parecidas se cargan ya, para poder medirlas al pulsar una línea.
        for (const f of new Set(r.map((x) => x.font))) loadFont(f);
      })
      .catch(() => alive && setRuns([]));
    return () => {
      alive = false;
    };
  }, [tool, page.docId, page.index]);

  /** Tapa el texto original con su color de fondo y pone encima una copia editable con su mismo formato. */
  const editRun = async (run: TextRun) => {
    if (api.editingId) api.setEditing(null);
    const box = runBox(run, runs);
    const canvas = pageRasterReady(page) ?? (await pageRaster(page).catch(() => null));
    const { bg, fg } = canvas ? sampleColors(canvas, page, box) : { bg: '#ffffff', fg: '#111111' };
    const coverId = uid('cover');
    // Si la línea ya se había editado, se parte de su texto actual y se quita el parche anterior.
    const prev = page.annotations.find((a) => a.type === 'whiteout' && a.sourceKey === run.key);
    const current = prev?.type === 'whiteout' && prev.lineText !== undefined ? prev.lineText : run.text;
    const text: TextAnn = {
      id: uid('txt'),
      type: 'text',
      x: run.x,
      y: run.baseline - run.fontSize * BASELINE,
      text: current,
      fontSize: Math.round(run.fontSize * 10) / 10,
      font: run.font,
      bold: run.bold,
      italic: run.italic,
      color: fg,
      coverId,
      sourceKey: run.key,
    };
    // Con la letra ya cargada se mide si la original es más ancha o estrecha (frecuente en DNI e importes).
    if (fontReady(run.font)) {
      // Misma altura que la letra que se ve en el PDF (los DNI e importes a veces van en una letra más alta).
      const ink = canvas ? inkAscent(canvas, page, run, runs, { bg, fg }) : null;
      const ours = measureAscent(text, run.text);
      if (ink && ours > 0) {
        const k = ink / ours;
        if (Math.abs(k - 1) > 0.08 && k > 0.75 && k < 1.45) {
          text.fontSize = Math.round(run.fontSize * k * 10) / 10;
          text.y = run.baseline - text.fontSize * BASELINE;
        }
        // Que la tapa cubra toda la letra original aunque sea más alta de lo que dice el PDF.
        const top = Math.min(box.y, run.baseline - ink - Math.max(0.6, run.fontSize * 0.06));
        box.h += box.y - top;
        box.y = top;
      }
      text.scaleX = fitScale(run, (s) => measureText(text, s));
    }
    api.update(
      page.id,
      (anns) => [...anns.filter((a) => !('sourceKey' in a && a.sourceKey === run.key)), { id: coverId, type: 'whiteout', ...box, color: bg, width: 0, sourceKey: run.key }, text],
      true,
    );
    api.select(page.id, text.id);
    api.setEditing(text.id);
  };

  // Los cambios de texto ya terminados se ven hechos dentro del PDF (igual que al descargar).
  const edits = textEditsOf(page.annotations, editingTextId(page, api.editingId));
  const editsKey = JSON.stringify(edits);
  const [edited, setEdited] = useState<EditedPage | null>(null);
  const [rendered, setRendered] = useState<PDFDocumentProxy | null>(null);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      editedPage(page, page.annotations, edits)
        .then((r) => alive && setEdited(r))
        .catch(() => alive && setEdited(null));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editsKey, page.docId, page.index]);
  useEffect(() => {
    const pdf = edited?.pdf;
    // La versión anterior se suelta cuando ya no se usa.
    return () => {
      if (pdf) setTimeout(() => pdf.destroy(), 2000);
    };
  }, [edited]);
  const handled = edited && rendered === edited.pdf ? edited.handled : null;

  const selectedId = api.selected?.pageId === page.id ? api.selected.annId : null;
  const selected = page.annotations.find((a) => a.id === selectedId) ?? null;
  const editing = page.annotations.find((a) => a.id === api.editingId) ?? null;
  const inputScale = editing?.type === 'text' ? Math.min(1, (editing.fontSize * zoom) / 16) : 1;

  /** Pasa de coordenadas de pantalla a puntos PDF de la página (deshaciendo zoom y rotación). */
  const toLocal = (clientX: number, clientY: number): [number, number] => {
    const r = wrapRef.current!.getBoundingClientRect();
    const vx = clientX - (r.left + r.width / 2);
    const vy = clientY - (r.top + r.height / 2);
    const t = (-page.rotation * Math.PI) / 180;
    const x = vx * Math.cos(t) - vy * Math.sin(t);
    const y = vx * Math.sin(t) + vy * Math.cos(t);
    return [(x + innerW / 2) / zoom, (y + innerH / 2) / zoom];
  };

  const clamp = (x: number, y: number): [number, number] => [Math.max(0, Math.min(page.width, x)), Math.max(0, Math.min(page.height, y))];

  const add = (a: Annotation) => {
    api.update(page.id, (anns) => [...anns, a], true);
    api.select(page.id, a.id);
  };

  const patch = (id: string, fn: (a: Annotation) => Annotation) =>
    api.update(page.id, (anns) => anns.map((a) => (a.id === id ? fn(a) : a)), false);

  const newText = (x: number, y: number, text = ''): TextAnn => ({
    id: uid('txt'),
    type: 'text',
    x,
    y: Math.max(0, y - style.fontSize * 0.6),
    text,
    fontSize: style.fontSize,
    font: style.font,
    bold: style.bold,
    italic: style.italic,
    color: style.color,
  });

  const viewer = () => wrapRef.current?.closest<HTMLElement>('.viewer') ?? null;

  const startGesture = (g: Gesture) => {
    gesture.current = g;
    api.gestureAbort.current = () => {
      const cur = gesture.current;
      gesture.current = null;
      api.gestureAbort.current = null;
      // Deshace lo que el primer dedo ya hubiera empezado (un trazo, una forma, un movimiento).
      if (cur && (cur.kind === 'create' || ('started' in cur && cur.started))) api.undo();
    };
  };

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const runKey = (e.target as HTMLElement).closest<HTMLElement>('.text-run')?.dataset.key ?? null;
    if (api.editingId && !runKey) {
      // El primer clic fuera solo termina la edición en curso.
      api.setEditing(null);
      if (tool === 'text' || tool === 'select') return;
    }
    const [x, y] = clamp(...toLocal(e.clientX, e.clientY));
    const capture = () => (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (TAP_TOOLS.includes(tool)) {
      const v = viewer();
      startGesture({ kind: 'tap', cx: e.clientX, cy: e.clientY, x, y, runKey, panning: false, sl: v?.scrollLeft ?? 0, st: v?.scrollTop ?? 0 });
      capture();
      e.preventDefault();
      return;
    }
    placeAt(x, y);
    if (gesture.current) capture();
  };

  /** Acción de la herramienta en un punto: colocar (tras un toque) o empezar a dibujar (al pulsar). */
  const placeAt = (x: number, y: number, runKey: string | null = null) => {
    switch (tool) {
      case 'select':
        api.select(page.id, null);
        return;
      case 'text': {
        const run = runKey ? runs.find((r) => r.key === runKey) : null;
        if (run) {
          editRun(run);
          return;
        }
        const t = newText(x, y);
        add(t);
        api.setEditing(t.id);
        return;
      }
      case 'date':
        add(newText(x, y, today()));
        return;
      case 'note': {
        const id = uid('note');
        add({ id, type: 'note', x: x - 4, y: y - 4, text: '', color: '#FFD84D' });
        api.setEditing(id);
        return;
      }
      case 'check':
      case 'cross':
      case 'dot': {
        const size = Math.max(10, style.fontSize * 1.1);
        add({ id: uid('mk'), type: 'mark', kind: tool, x: x - size / 2, y: y - size / 2, size, color: style.color });
        return;
      }
      case 'stamp': {
        if (!api.stamp) return;
        const { w, h } = api.stamp;
        add({ id: uid('img'), type: 'image', x: Math.max(0, x - w / 2), y: Math.max(0, y - h / 2), w, h, src: api.stamp.src, signature: api.stamp.signature });
        api.onStampPlaced();
        return;
      }
      case 'draw': {
        const id = uid('ink');
        add({ id, type: 'ink', points: [[x, y]], color: style.color, width: style.width });
        startGesture({ kind: 'create', id, x0: x, y0: y });
        return;
      }
      case 'line':
      case 'arrow': {
        const id = uid('ln');
        add({ id, type: tool, x1: x, y1: y, x2: x, y2: y, color: style.color, width: style.width });
        startGesture({ kind: 'create', id, x0: x, y0: y });
        return;
      }
      default:
        if (BOX_TOOLS.includes(tool)) {
          const id = uid('box');
          const color = tool === 'highlight' ? (style.color === '#111827' ? '#FDE047' : style.color) : tool === 'whiteout' ? '#ffffff' : style.color;
          add({ id, type: tool as 'rect', x, y, w: 0, h: 0, color, width: style.width });
          startGesture({ kind: 'create', id, x0: x, y0: y });
        }
    }
  };

  const onAnnDown = (e: React.PointerEvent, a: Annotation) => {
    const interactive = tool === 'select' || (tool === 'text' && a.type === 'text');
    if (!interactive || e.button !== 0) return;
    e.stopPropagation();
    if (api.editingId && api.editingId !== a.id) api.setEditing(null);
    api.select(page.id, a.id);
    // Un trozo ya editado de una línea del PDF: se vuelve a abrir la línea entera.
    const sourceRun = tool === 'text' && a.type === 'text' && a.keep ? runs.find((r) => r.key === a.sourceKey) : null;
    if (sourceRun) {
      e.preventDefault();
      editRun(sourceRun);
      return;
    }
    if (tool === 'text' && a.type === 'text') {
      api.checkpoint();
      api.setEditing(a.id);
      e.preventDefault();
      return;
    }
    const [x0, y0] = toLocal(e.clientX, e.clientY);
    startGesture({ kind: 'move', id: a.id, x0, y0, start: a, started: false });
    wrapRef.current!.querySelector<HTMLElement>('.page-overlay')!.setPointerCapture(e.pointerId);
  };

  const onHandleDown = (e: React.PointerEvent, kind: 'resize' | 1 | 2) => {
    if (!selected) return;
    e.stopPropagation();
    const [x0, y0] = toLocal(e.clientX, e.clientY);
    startGesture(
      kind === 'resize'
        ? { kind: 'resize', id: selected.id, x0, y0, start: selected, started: false }
        : { kind: 'endpoint', id: selected.id, end: kind, start: selected, started: false },
    );
    wrapRef.current!.querySelector<HTMLElement>('.page-overlay')!.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'tap') {
      const dx = e.clientX - g.cx;
      const dy = e.clientY - g.cy;
      if (!g.panning && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      g.panning = true;
      const v = viewer();
      if (v) {
        v.scrollLeft = g.sl - dx;
        v.scrollTop = g.st - dy;
      }
      return;
    }
    const [x, y] = toLocal(e.clientX, e.clientY);
    if (g.kind !== 'create' && !g.started) {
      if (g.kind !== 'endpoint' && Math.hypot(x - g.x0, y - g.y0) * zoom < 3) return;
      g.started = true;
      api.checkpoint();
    }
    switch (g.kind) {
      case 'move':
        patch(g.id, () => translate(g.start, x - g.x0, y - g.y0));
        break;
      case 'resize':
        patch(g.id, (a) => resizeTo(a, g.start, x - g.x0, y - g.y0, !e.shiftKey));
        break;
      case 'endpoint': {
        const [cx, cy] = clamp(x, y);
        patch(g.id, (a) => (g.end === 1 ? { ...a, x1: cx, y1: cy } : { ...a, x2: cx, y2: cy }) as Annotation);
        break;
      }
      case 'create': {
        const [cx, cy] = clamp(x, y);
        patch(g.id, (a) => {
          if (a.type === 'ink') return { ...a, points: [...a.points, [cx, cy] as [number, number]] };
          if (a.type === 'line' || a.type === 'arrow') return { ...a, x2: cx, y2: cy };
          if ('w' in a)
            return { ...a, x: Math.min(g.x0, cx), y: Math.min(g.y0, cy), w: Math.abs(cx - g.x0), h: Math.abs(cy - g.y0) };
          return a;
        });
      }
    }
  };

  const onUp = () => {
    const g = gesture.current;
    gesture.current = null;
    api.gestureAbort.current = null;
    if (g?.kind === 'tap') {
      if (!g.panning) placeAt(g.x, g.y, g.runKey);
      return;
    }
    if (!g || g.kind !== 'create') return;
    // Un clic sin arrastrar crea la forma con un tamaño por defecto.
    patch(g.id, (a) => {
      if ((a.type === 'line' || a.type === 'arrow') && Math.hypot(a.x2 - a.x1, a.y2 - a.y1) < 4)
        return { ...a, x2: a.x1 + 100, y2: a.y1 };
      if ('w' in a && a.type !== 'image' && a.w < 4 && a.h < 4) {
        const [w, h] = DEFAULT_BOX[a.type];
        return { ...a, w, h, y: a.y - h / 2 };
      }
      return a;
    });
  };

  // Al empezar a editar texto, pon el foco y el cursor al final.
  useEffect(() => {
    const el = textRef.current;
    if (el && editing?.type === 'text') {
      // Sin preventScroll, Safari desplaza la página al dar el foco y el texto parece «saltar».
      el.focus({ preventScroll: true });
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing?.id]);

  /**
   * Al dejar de editar un texto (por cualquier motivo: tocar fuera, abrir otro, cambiar de herramienta):
   * si es un texto del PDF que no se ha cambiado, se quita la tapa y se deja el original tal cual;
   * si se ha quedado vacío, se borra (en un texto del PDF, la tapa queda y eso es «borrar la línea»).
   */
  const settleText = (id: string) => {
    const a = page.annotations.find((x) => x.id === id);
    if (a?.type !== 'text') return;
    const source = a.coverId && !a.keep ? runs.find((r) => r.key === a.sourceKey) : null;
    if (source) {
      const cover = page.annotations.find((x) => x.id === a.coverId);
      if (a.text === source.text || cover?.type !== 'whiteout') {
        api.update(page.id, (anns) => anns.filter((x) => x.id !== a.id && x.id !== a.coverId), false);
      } else {
        const [patchCover, patchText] = minimalPatch(source, a, cover);
        api.update(page.id, (anns) => anns.flatMap((x) => (x.id === a.coverId ? [patchCover] : x.id === a.id ? (patchText ? [patchText] : []) : [x])), false);
      }
      if (selectedId === a.id) api.select(page.id, null);
    } else if (!a.text.trim()) {
      api.update(page.id, (anns) => anns.filter((x) => x.id !== a.id), false);
      if (selectedId === a.id) api.select(page.id, null);
    }
  };
  const prevEditing = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevEditing.current;
    prevEditing.current = api.editingId;
    if (prev && prev !== api.editingId) settleText(prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.editingId]);

  const finishEditing = () => api.setEditing(null);

  const interactiveAnns = tool === 'select' || tool === 'text';
  const cursor =
    tool === 'select' ? 'grab' : tool === 'text' ? 'text' : tool === 'stamp' ? 'copy' : TAP_TOOLS.includes(tool) ? 'pointer' : 'crosshair';

  const box = selected ? bbox(selected) : null;

  return (
    <div className="page-slot" data-page-id={page.id} data-page-number={number}>
      <div ref={wrapRef} className="page-wrap" style={{ width: outerW, height: outerH }}>
        <div
          className="page-inner"
          style={{
            width: innerW,
            height: innerH,
            transform: `translate(-50%, -50%) rotate(${page.rotation}deg)`,
          }}
        >
          <PageCanvas page={page} scale={zoom} source={edited?.pdf ?? null} onRendered={setRendered} />
          <div
            className={`page-overlay${interactiveAnns ? ' is-interactive' : ''}`}
            style={{ cursor }}
            onPointerDown={onBackgroundDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {tool === 'text' && (
              <div className="text-runs">
                {runs
                  .filter((r) => !(editing?.type === 'text' && editing.sourceKey === r.key))
                  .map((r) => {
                    const b = runBox(r);
                    return (
                      <button
                        key={r.key}
                        className="text-run"
                        data-key={r.key}
                        title="Editar este texto"
                        aria-label={`Editar texto: ${r.text}`}
                        style={{ left: b.x * zoom, top: b.y * zoom, width: b.w * zoom, height: b.h * zoom }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            editRun(r);
                          }
                        }}
                      />
                    );
                  })}
              </div>
            )}
            <svg className="ann-svg" viewBox={`0 0 ${page.width} ${page.height}`} width={innerW} height={innerH}>
              {page.annotations.map((a) => (
                <AnnotationShape
                  key={a.id}
                  a={a}
                  hidden={editing?.id === a.id && a.type === 'text'}
                  ghost={!!handled?.has(a.id)}
                  onPointerDown={onAnnDown}
                  onDoubleClick={(ann) => {
                    if (ann.type === 'text' || ann.type === 'note') {
                      api.checkpoint();
                      api.setEditing(ann.id);
                    }
                  }}
                />
              ))}
            </svg>

            {selected && box && editing?.id !== selected.id && (
              <div
                className="selection"
                style={{ left: box.x * zoom - 4, top: box.y * zoom - 4, width: box.w * zoom + 8, height: box.h * zoom + 8 }}
              >
                {canResize(selected) && (
                  <span className="handle handle-br" onPointerDown={(e) => onHandleDown(e, 'resize')} title="Cambiar tamaño" />
                )}
              </div>
            )}
            {selected && (selected.type === 'line' || selected.type === 'arrow') && (
              <>
                <span className="handle handle-pt" style={{ left: selected.x1 * zoom, top: selected.y1 * zoom }} onPointerDown={(e) => onHandleDown(e, 1)} />
                <span className="handle handle-pt" style={{ left: selected.x2 * zoom, top: selected.y2 * zoom }} onPointerDown={(e) => onHandleDown(e, 2)} />
              </>
            )}

            {editing?.type === 'text' && (
              <textarea
                ref={textRef}
                className="text-editor"
                aria-label="Texto"
                value={editing.text}
                spellCheck={false}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => patch(editing.id, (a) => ({ ...a, text: e.target.value }) as Annotation)}
                onBlur={finishEditing}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  }
                  e.stopPropagation();
                }}
                style={{
                  left: editing.x * zoom,
                  top: editing.y * zoom,
                  // El iPhone amplía toda la página al escribir en un campo con letra de menos de 16 px.
                  // Se escribe a 16 px y se reduce con transform: se ve igual y no hay zoom.
                  width: Math.max(60, bbox(editing).w * zoom + editing.fontSize * zoom * 2) / (inputScale * (editing.scaleX ?? 1)),
                  height: (editing.text.split('\n').length * editing.fontSize * LINE_HEIGHT * zoom + 2) / inputScale,
                  fontSize: (editing.fontSize * zoom) / inputScale,
                  transform: inputScale < 1 || editing.scaleX ? `scale(${inputScale * (editing.scaleX ?? 1)}, ${inputScale})` : undefined,
                  transformOrigin: '0 0',
                  borderWidth: 1 / inputScale,
                  fontFamily: FONT_CSS[editing.font],
                  fontWeight: editing.bold ? 700 : 400,
                  fontStyle: editing.italic ? 'italic' : 'normal',
                  color: editing.color,
                  lineHeight: LINE_HEIGHT,
                }}
              />
            )}

            {editing?.type === 'note' && (
              <div
                className="note-pop"
                style={{ left: Math.min(editing.x * zoom, innerW - 240), top: editing.y * zoom + 28 }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <textarea
                  autoFocus
                  aria-label="Texto de la nota"
                  placeholder="Escribe un comentario…"
                  value={editing.text}
                  onChange={(e) => patch(editing.id, (a) => ({ ...a, text: e.target.value }) as Annotation)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') api.setEditing(null);
                    e.stopPropagation();
                  }}
                />
                <div className="note-pop-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      api.update(page.id, (anns) => anns.filter((a) => a.id !== editing.id), true);
                      api.setEditing(null);
                    }}
                  >
                    Eliminar
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => api.setEditing(null)}>
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="page-number">{number}</div>
    </div>
  );
}

/** El texto que se está escribiendo ahora en esta página (su cambio aún no se aplica dentro del PDF). */
function editingTextId(page: Page, id: string | null) {
  return id && page.annotations.some((a) => a.id === id && a.type === 'text') ? id : null;
}

/**
 * Convierte la edición de una línea entera en un parche mínimo: se busca qué palabras cambiaron y solo
 * esas se tapan y se vuelven a escribir. El resto conserva las letras, el espaciado y la tipografía
 * originales del PDF. Si el texto nuevo no cabe en el hueco, se redibuja también hasta el final de la línea.
 */
function minimalPatch(run: TextRun, t: TextAnn, cover: BoxAnn): [Annotation, TextAnn | null] {
  const O = run.text;
  const N = t.text;
  const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);
  let p = 0;
  while (p < O.length && p < N.length && O[p] === N[p]) p++;
  let s = 0;
  while (s < O.length - p && s < N.length - p && O[O.length - 1 - s] === N[N.length - 1 - s]) s++;
  // A palabras enteras: así no se mezclan dos letras distintas dentro de una misma palabra.
  while (p > 0 && !(isSpace(O[p - 1]) || isSpace(O[p]))) p--;
  while (s > 0 && !(isSpace(O[O.length - s - 1]) || isSpace(O[O.length - s]))) s--;
  const measure = (str: string) => measureText(t, str);
  let x0 = charX(run, p, measure);
  let x1 = charX(run, O.length - s, measure);
  let mid = N.slice(p, N.length - s);
  if (measure(mid) > x1 - x0 + t.fontSize * 0.25) {
    s = 0;
    x1 = run.x + run.width;
    mid = N.slice(p);
  }
  // Los espacios de los bordes no se dibujan: el hueco ya lo da el texto original que queda.
  const lead = mid.length - mid.trimStart().length;
  if (lead) x0 = charX(run, p + Math.min(lead, O.length - s - p), measure);
  mid = mid.trim();
  const pad = Math.max(0.4, t.fontSize * 0.04);
  const left = p === 0 ? cover.x : x0 - pad;
  const right = s === 0 ? cover.x + cover.w : x1 + pad;
  const patchText = mid ? { ...t, x: p === 0 ? t.x : x0, text: mid, keep: [p, s] as [number, number] } : null;
  const patchCover = {
    ...cover,
    x: left,
    w: Math.max(0, right - left),
    lineText: N,
    oldText: O.slice(p, O.length - s),
    textSig: patchText ? textSig(patchText) : undefined,
  };
  return [patchCover, patchText];
}
