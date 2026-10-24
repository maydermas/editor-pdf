import { useEffect, useRef, useState } from 'react';
import type { Annotation, Page, TextAnn, Tool, ToolStyle } from '../types';
import { PageCanvas } from './PageCanvas';
import { AnnotationShape } from './AnnotationSvg';
import { BASELINE, FONT_CSS, LINE_HEIGHT, bbox, canResize, resizeTo, today, translate } from '../lib/annotations';
import { getTextRuns, pageRaster, pageRasterReady, runBox, sampleColors, type TextRun } from '../lib/textRuns';
import { uid } from '../lib/id';

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
}

type Gesture =
  | { kind: 'move'; id: string; x0: number; y0: number; start: Annotation; started: boolean }
  | { kind: 'resize'; id: string; x0: number; y0: number; start: Annotation; started: boolean }
  | { kind: 'endpoint'; id: string; end: 1 | 2; start: Annotation; started: boolean }
  | { kind: 'create'; id: string; x0: number; y0: number };

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
      })
      .catch(() => alive && setRuns([]));
    return () => {
      alive = false;
    };
  }, [tool, page.docId, page.index]);
  const replaced = new Set(page.annotations.map((a) => ('sourceKey' in a ? a.sourceKey : undefined)).filter(Boolean));

  /** Tapa el texto original con su color de fondo y pone encima una copia editable con su mismo formato. */
  const editRun = async (run: TextRun) => {
    if (api.editingId) api.setEditing(null);
    const box = runBox(run);
    const canvas = pageRasterReady(page) ?? (await pageRaster(page).catch(() => null));
    const { bg, fg } = canvas ? sampleColors(canvas, page, box) : { bg: '#ffffff', fg: '#111111' };
    const coverId = uid('cover');
    const text: TextAnn = {
      id: uid('txt'),
      type: 'text',
      x: run.x,
      y: run.baseline - run.fontSize * BASELINE,
      text: run.text,
      fontSize: Math.round(run.fontSize * 10) / 10,
      font: run.font,
      bold: run.bold,
      italic: run.italic,
      color: fg,
      coverId,
      sourceKey: run.key,
    };
    api.update(page.id, (anns) => [...anns, { id: coverId, type: 'whiteout', ...box, color: bg, width: 0, sourceKey: run.key }, text], true);
    api.select(page.id, text.id);
    api.setEditing(text.id);
  };

  const selectedId = api.selected?.pageId === page.id ? api.selected.annId : null;
  const selected = page.annotations.find((a) => a.id === selectedId) ?? null;
  const editing = page.annotations.find((a) => a.id === api.editingId) ?? null;

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

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (api.editingId) {
      // El primer clic fuera solo termina la edición en curso.
      api.setEditing(null);
      if (tool === 'text' || tool === 'select') return;
    }
    const [x, y] = clamp(...toLocal(e.clientX, e.clientY));
    const capture = () => (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    switch (tool) {
      case 'select':
        api.select(page.id, null);
        return;
      case 'text': {
        const t = newText(x, y);
        add(t);
        api.setEditing(t.id);
        e.preventDefault();
        return;
      }
      case 'date':
        add(newText(x, y, today()));
        return;
      case 'note': {
        const id = uid('note');
        add({ id, type: 'note', x: x - 4, y: y - 4, text: '', color: '#FFD84D' });
        api.setEditing(id);
        e.preventDefault();
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
        gesture.current = { kind: 'create', id, x0: x, y0: y };
        capture();
        return;
      }
      case 'line':
      case 'arrow': {
        const id = uid('ln');
        add({ id, type: tool, x1: x, y1: y, x2: x, y2: y, color: style.color, width: style.width });
        gesture.current = { kind: 'create', id, x0: x, y0: y };
        capture();
        return;
      }
      default:
        if (BOX_TOOLS.includes(tool)) {
          const id = uid('box');
          const color = tool === 'highlight' ? (style.color === '#111827' ? '#FDE047' : style.color) : tool === 'whiteout' ? '#ffffff' : style.color;
          add({ id, type: tool as 'rect', x, y, w: 0, h: 0, color, width: style.width });
          gesture.current = { kind: 'create', id, x0: x, y0: y };
          capture();
        }
    }
  };

  const onAnnDown = (e: React.PointerEvent, a: Annotation) => {
    const interactive = tool === 'select' || (tool === 'text' && a.type === 'text');
    if (!interactive || e.button !== 0) return;
    e.stopPropagation();
    if (api.editingId && api.editingId !== a.id) api.setEditing(null);
    api.select(page.id, a.id);
    if (tool === 'text' && a.type === 'text') {
      api.checkpoint();
      api.setEditing(a.id);
      e.preventDefault();
      return;
    }
    const [x0, y0] = toLocal(e.clientX, e.clientY);
    gesture.current = { kind: 'move', id: a.id, x0, y0, start: a, started: false };
    wrapRef.current!.querySelector<HTMLElement>('.page-overlay')!.setPointerCapture(e.pointerId);
  };

  const onHandleDown = (e: React.PointerEvent, kind: 'resize' | 1 | 2) => {
    if (!selected) return;
    e.stopPropagation();
    const [x0, y0] = toLocal(e.clientX, e.clientY);
    gesture.current =
      kind === 'resize'
        ? { kind: 'resize', id: selected.id, x0, y0, start: selected, started: false }
        : { kind: 'endpoint', id: selected.id, end: kind, start: selected, started: false };
    wrapRef.current!.querySelector<HTMLElement>('.page-overlay')!.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
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
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing?.id]);

  const finishEditing = () => {
    if (editing?.type === 'text' && !editing.text.trim()) {
      api.update(page.id, (anns) => anns.filter((a) => a.id !== editing.id), false);
      api.select(page.id, null);
    }
    api.setEditing(null);
  };

  const interactiveAnns = tool === 'select' || tool === 'text';
  const cursor =
    tool === 'select' ? 'default' : tool === 'text' ? 'text' : tool === 'stamp' ? 'copy' : 'crosshair';

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
          <PageCanvas page={page} scale={zoom} />
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
                  .filter((r) => !replaced.has(r.key))
                  .map((r) => {
                    const b = runBox(r);
                    return (
                      <button
                        key={r.key}
                        className="text-run"
                        title="Editar este texto"
                        aria-label={`Editar texto: ${r.text}`}
                        style={{ left: b.x * zoom, top: b.y * zoom, width: b.w * zoom, height: b.h * zoom }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          editRun(r);
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
                  width: Math.max(60, bbox(editing).w * zoom + editing.fontSize * zoom * 2),
                  height: editing.text.split('\n').length * editing.fontSize * LINE_HEIGHT * zoom + 2,
                  fontSize: editing.fontSize * zoom,
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
