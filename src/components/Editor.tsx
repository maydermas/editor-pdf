import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Annotation, ExportFormat, Intent, Page, Tool, ToolStyle } from '../types';
import { useHistory } from '../lib/useHistory';
import { uid } from '../lib/id';
import { translate } from '../lib/annotations';
import { LoadError, createBlankPage, loadFile } from '../lib/docs';
import { BRAND } from '../config';
import { PageView, type PageApi, type Stamp } from './PageView';
import { Sidebar } from './Sidebar';
import { PropertiesBar, SHORTCUTS, Toolbar } from './Toolbar';
import { SignatureModal } from './SignatureModal';
import { ExportModal } from './ExportModal';
import { AdSlot } from './AdSlot';
import { Icon } from './Icon';
import { Logo } from './Logo';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** Punto de una página que debe quedarse bajo el ratón o los dedos al hacer zoom. */
interface Anchor {
  idx: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
}

const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

const cloneAnn = (a: Annotation, offset = 0): Annotation => ({ ...translate(a, offset, offset), id: uid('ann') });

interface Props {
  initialPages: Page[];
  fileName: string;
  intent: Intent;
  onExit: () => void;
}

export function Editor({ initialPages, fileName: initialName, intent, onExit }: Props) {
  const history = useHistory<Page[]>(initialPages);
  const pages = history.present;
  const [tool, setTool] = useState<Tool>(intent.tool ?? 'text');
  const [style, setStyle] = useState<ToolStyle>({ color: '#111827', width: 2, fontSize: 14, font: 'helvetica', bold: false, italic: false });
  const [selected, setSelected] = useState<{ pageId: string; annId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(0);
  const [fileName, setFileName] = useState(initialName);
  const [showSignature, setShowSignature] = useState(!!intent.openSignature);
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(intent.exportFormat ?? null);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  // La columna de publicidad solo cabe en pantallas anchas; en el resto no se carga.
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [toast, setToast] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const clipboard = useRef<Annotation | null>(null);
  const gestureAbort = useRef<(() => void) | null>(null);
  const anchor = useRef<Anchor | null>(null);
  const [anchorTick, setAnchorTick] = useState(0);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist0: number } | null>(null);
  /**
   * Zoom «visual» mientras dura un pellizco o la rueda: solo se escalan las páginas con CSS
   * (barato) y al terminar se fija el zoom real, que es cuando se vuelven a pintar.
   */
  const visual = useRef<{
    zoom0: number;
    c0x: number;
    c0y: number;
    s: number;
    cx: number;
    cy: number;
    anchor: Anchor | null;
    slots: { el: HTMLElement; ox: number; oy: number }[];
  } | null>(null);
  const clearVisual = useRef(false);
  const wheelTimer = useRef(0);
  const dragPan = useRef<{ x: number; y: number; sl: number; st: number; id: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const dirty = history.canUndo;

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }, []);

  // Zoom inicial: ajustar al ancho disponible.
  const fitWidth = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    const maxW = Math.max(...history.get().map((p) => (p.rotation % 180 ? p.height : p.width)));
    setZoom(Math.max(0.25, Math.min(1.5, (el.clientWidth - 48) / maxW)));
  }, [history]);
  useLayoutEffect(fitWidth, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const selectedAnn = useMemo(() => {
    if (!selected) return null;
    return pages.find((p) => p.id === selected.pageId)?.annotations.find((a) => a.id === selected.annId) ?? null;
  }, [pages, selected]);

  const update = useCallback<PageApi['update']>(
    (pageId, fn, record) => {
      const apply = (prev: Page[]) => prev.map((p) => (p.id === pageId ? { ...p, annotations: fn(p.annotations) } : p));
      if (record) history.set(apply);
      else history.replace(apply);
    },
    [history],
  );

  const chooseTool = (t: Tool) => {
    setTool(t);
    setEditingId(null);
    if (t !== 'stamp') setStamp(null);
    if (t !== 'select') setSelected(null);
  };

  const deleteSelected = () => {
    if (!selected) return;
    update(selected.pageId, (anns) => anns.filter((a) => a.id !== selected.annId), true);
    setSelected(null);
    setEditingId(null);
  };

  const duplicateSelected = () => {
    if (!selected || !selectedAnn) return;
    const copy = cloneAnn(selectedAnn, 12);
    update(selected.pageId, (anns) => [...anns, copy], true);
    setSelected({ pageId: selected.pageId, annId: copy.id });
  };

  const onStyle = (patch: Partial<ToolStyle>) => {
    setStyle((s) => ({ ...s, ...patch }));
    if (!selected || !selectedAnn) return;
    update(
      selected.pageId,
      (anns) =>
        anns.map((a) => {
          if (a.id !== selected.annId) return a;
          let next = { ...a } as Annotation;
          if (patch.color && 'color' in next) next = { ...next, color: patch.color } as Annotation;
          if (patch.width !== undefined && 'width' in next) next = { ...next, width: patch.width } as Annotation;
          if (next.type === 'text') {
            if (patch.fontSize) next.fontSize = patch.fontSize;
            if (patch.font) next.font = patch.font;
            if (patch.bold !== undefined) next.bold = patch.bold;
            if (patch.italic !== undefined) next.italic = patch.italic;
          }
          if (next.type === 'mark' && patch.fontSize) next.size = patch.fontSize * 1.1;
          return next;
        }),
      true,
    );
  };

  const goTo = (i: number) => {
    const slot = mainRef.current?.querySelector<HTMLElement>(`[data-page-number="${i + 1}"]`);
    slot?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setCurrent(i);
  };

  const onScroll = () => {
    const el = mainRef.current;
    if (!el) return;
    const mark = el.getBoundingClientRect().top + el.clientHeight / 3;
    const slots = el.querySelectorAll<HTMLElement>('[data-page-number]');
    let idx = 0;
    slots.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= mark) idx = i;
    });
    setCurrent(idx);
  };

  /** Guarda qué punto de qué página hay bajo (cx, cy) para mantenerlo ahí tras el zoom. */
  const setAnchorAt = (cx: number, cy: number) => {
    const wraps = mainRef.current?.querySelectorAll<HTMLElement>('.page-wrap');
    if (!wraps?.length) return;
    let best = 0;
    let bestDist = Infinity;
    wraps.forEach((w, i) => {
      const r = w.getBoundingClientRect();
      const d = cy < r.top ? r.top - cy : cy > r.bottom ? cy - r.bottom : 0;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    const r = wraps[best].getBoundingClientRect();
    anchor.current = { idx: best, fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height, cx, cy };
  };

  // Tras cada cambio de zoom (o de posición de los dedos), recoloca el scroll para que el punto anclado no se mueva.
  const applyAnchor = () => {
    const a = anchor.current;
    const v = mainRef.current;
    if (!a || !v) return;
    const w = v.querySelectorAll<HTMLElement>('.page-wrap')[a.idx];
    if (!w) return;
    const r = w.getBoundingClientRect();
    v.scrollLeft += r.left + a.fx * r.width - a.cx;
    v.scrollTop += r.top + a.fy * r.height - a.cy;
  };
  useLayoutEffect(() => {
    // Quita la escala CSS del gesto justo antes de pintar con el zoom nuevo: así no hay saltos.
    if (clearVisual.current) {
      clearVisual.current = false;
      mainRef.current?.querySelectorAll<HTMLElement>('.page-slot').forEach((el) => {
        el.style.transform = '';
        el.style.transformOrigin = '';
        el.style.willChange = '';
      });
    }
    applyAnchor();
    if (!pinch.current) anchor.current = null;
  }, [zoom, anchorTick]);

  const beginVisual = (cx: number, cy: number) => {
    // El ancla se toma antes de transformar nada (getBoundingClientRect incluye las transformaciones).
    setAnchorAt(cx, cy);
    const a = anchor.current;
    anchor.current = null;
    const slots = [...(mainRef.current?.querySelectorAll<HTMLElement>('.page-slot') ?? [])].map((el) => {
      const r = el.getBoundingClientRect();
      el.style.willChange = 'transform';
      return { el, ox: cx - r.left, oy: cy - r.top };
    });
    visual.current = { zoom0: zoomRef.current, c0x: cx, c0y: cy, s: 1, cx, cy, anchor: a, slots };
  };

  /** El punto que estaba bajo (c0x, c0y) pasa a (cx, cy), ampliado `scale` veces. */
  const updateVisual = (scale: number, cx: number, cy: number) => {
    const v = visual.current;
    if (!v) return;
    v.s = clampZoom(v.zoom0 * scale) / v.zoom0;
    v.cx = cx;
    v.cy = cy;
    for (const { el, ox, oy } of v.slots) {
      el.style.transformOrigin = `${ox}px ${oy}px`;
      el.style.transform = `translate(${cx - v.c0x}px, ${cy - v.c0y}px) scale(${v.s})`;
    }
  };

  const commitVisual = () => {
    const v = visual.current;
    if (!v) return;
    visual.current = null;
    anchor.current = v.anchor && { ...v.anchor, cx: v.cx, cy: v.cy };
    clearVisual.current = true;
    const next = clampZoom(v.zoom0 * v.s);
    zoomRef.current = next;
    setZoom(next);
    setAnchorTick((t) => t + 1);
  };

  /** Zoom manteniendo fijo el punto (cx, cy); sin punto, el centro del visor. */
  const zoomTo = (next: number, cx?: number, cy?: number) => {
    const v = mainRef.current;
    if (v) {
      const r = v.getBoundingClientRect();
      setAnchorAt(cx ?? r.left + r.width / 2, cy ?? r.top + r.height / 2);
    }
    setZoom(clampZoom(next));
  };

  const stepZoom = (dir: 1 | -1) => {
    const next = dir > 0 ? ZOOMS.find((v) => v > zoom + 0.001) : [...ZOOMS].reverse().find((v) => v < zoom - 0.001);
    if (next) zoomTo(next);
  };

  // Ctrl/⌘ + rueda (y el pellizco del trackpad, que llega igual) hace zoom donde está el ratón.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
      if (!visualRef.current.active()) visualRef.current.begin(e.clientX, e.clientY);
      visualRef.current.update(factor, e.clientX, e.clientY);
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => visualRef.current.commit(), 180);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const visualRef = useRef({
    active: () => !!visual.current,
    begin: beginVisual,
    commit: commitVisual,
    update: (factor: number, cx: number, cy: number) => updateVisual((visual.current?.s ?? 1) * factor, cx, cy),
  });
  visualRef.current.begin = beginVisual;
  visualRef.current.commit = commitVisual;

  // --- Dos dedos (mover y pellizcar), botón central o espacio + arrastrar (mover) ---
  const center = () => {
    const pts = [...touches.current.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2, d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) };
  };

  const onViewerPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      // El primer dedo de un gesto nuevo: olvida dedos de gestos anteriores cuyo «soltar» no llegó.
      if (e.isPrimary) {
        touches.current.clear();
        pinch.current = null;
      }
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size >= 2) {
        e.stopPropagation();
        e.preventDefault();
        if (!pinch.current) {
          dragPan.current = null;
          gestureAbort.current?.();
          if (visual.current) commitVisual();
          const c = center();
          pinch.current = { dist0: Math.max(c.d, 1) };
          beginVisual(c.x, c.y);
        }
      }
      if (touches.current.size === 1 && e.target === e.currentTarget) {
        const v = mainRef.current!;
        dragPan.current = { x: e.clientX, y: e.clientY, sl: v.scrollLeft, st: v.scrollTop, id: e.pointerId };
      }
      return;
    }
    // Botón central, espacio + arrastrar, o arrastrar en el hueco gris entre páginas.
    if (e.button === 1 || (e.button === 0 && (spaceHeld || e.target === e.currentTarget))) {
      e.stopPropagation();
      e.preventDefault();
      const v = mainRef.current!;
      dragPan.current = { x: e.clientX, y: e.clientY, sl: v.scrollLeft, st: v.scrollTop, id: e.pointerId };
      v.setPointerCapture(e.pointerId);
    }
  };

  const onViewerPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = dragPan.current;
      if (d && d.id === e.pointerId && !pinch.current) {
        mainRef.current!.scrollLeft = d.sl - (e.clientX - d.x);
        mainRef.current!.scrollTop = d.st - (e.clientY - d.y);
        return;
      }
      if (pinch.current && touches.current.size >= 2) {
        e.stopPropagation();
        const c = center();
        updateVisual(c.d / pinch.current.dist0, c.x, c.y);
      }
      return;
    }
    const d = dragPan.current;
    if (d && d.id === e.pointerId) {
      e.stopPropagation();
      mainRef.current!.scrollLeft = d.sl - (e.clientX - d.x);
      mainRef.current!.scrollTop = d.st - (e.clientY - d.y);
    }
  };

  const onViewerPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId);
      if (dragPan.current?.id === e.pointerId) dragPan.current = null;
      if (pinch.current) {
        e.stopPropagation();
        if (touches.current.size < 2) {
          pinch.current = null;
          commitVisual();
        }
      }
      return;
    }
    if (dragPan.current?.id === e.pointerId) {
      e.stopPropagation();
      dragPan.current = null;
    }
  };

  useEffect(() => {
    const isTyping = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]');
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // --- Operaciones de página ---
  const movePage = (from: number, to: number) =>
    history.set((prev) => {
      const next = [...prev];
      const [p] = next.splice(from, 1);
      next.splice(to, 0, p);
      return next;
    });
  const rotatePage = (i: number, dir: 1 | -1) =>
    history.set((prev) => prev.map((p, j) => (j === i ? { ...p, rotation: (((p.rotation + dir * 90) % 360) + 360) % 360 as Page['rotation'] } : p)));
  const duplicatePage = (i: number) =>
    history.set((prev) => {
      const next = [...prev];
      next.splice(i + 1, 0, { ...prev[i], id: uid('pg'), annotations: prev[i].annotations.map((a) => cloneAnn(a)) });
      return next;
    });
  const deletePage = (i: number) => {
    if (pages.length <= 1) return;
    if (selected?.pageId === pages[i].id) setSelected(null);
    history.set((prev) => prev.filter((_, j) => j !== i));
  };
  const addBlank = async () => {
    const page = await createBlankPage();
    history.set((prev) => {
      const next = [...prev];
      next.splice(current + 1, 0, page);
      return next;
    });
    setTimeout(() => goTo(current + 1), 50);
  };
  const insertFiles = async (files: FileList) => {
    try {
      const added: Page[] = [];
      for (const f of Array.from(files)) added.push(...(await loadFile(f, BRAND.maxUploadMB)));
      history.set((prev) => [...prev, ...added]);
      notify(`Se añadieron ${added.length} página${added.length === 1 ? '' : 's'} al final.`);
    } catch (e) {
      notify(e instanceof LoadError ? e.message : 'No se pudo añadir el archivo.');
    }
  };

  const onImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let src = String(reader.result);
        if (!/^data:image\/(png|jpeg)/.test(src)) {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d')!.drawImage(img, 0, 0);
          src = c.toDataURL('image/png');
        }
        const scale = Math.min(1, 240 / Math.max(img.naturalWidth, img.naturalHeight));
        setStamp({ src, w: img.naturalWidth * scale, h: img.naturalHeight * scale, signature: false });
        setTool('stamp');
        setSelected(null);
      };
      img.onerror = () => notify('No se pudo leer la imagen.');
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // --- Atajos de teclado ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable], .modal')) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        setSelected(null);
      } else if (mod && k === 'y') {
        e.preventDefault();
        history.redo();
      } else if (mod && k === 'c' && selectedAnn) {
        clipboard.current = selectedAnn;
      } else if (mod && k === 'v' && clipboard.current) {
        e.preventDefault();
        const copy = cloneAnn(clipboard.current, 12);
        clipboard.current = copy;
        const pageId = pages[current]?.id;
        if (pageId) {
          update(pageId, (anns) => [...anns, copy], true);
          setSelected({ pageId, annId: copy.id });
          setTool('select');
        }
      } else if (mod && k === 'd' && selectedAnn) {
        e.preventDefault();
        duplicateSelected();
      } else if ((k === 'delete' || k === 'backspace') && selected) {
        e.preventDefault();
        deleteSelected();
      } else if (k === 'escape') {
        if (stamp) chooseTool('select');
        else if (selected) setSelected(null);
        else setTool('select');
      } else if (k.startsWith('arrow') && selected) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx = k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0;
        const dy = k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0;
        update(selected.pageId, (anns) => anns.map((a) => (a.id === selected.annId ? translate(a, dx, dy) : a)), true);
      } else if (!mod && !e.altKey && SHORTCUTS[k]) {
        chooseTool(SHORTCUTS[k]);
      } else if (!mod && k === 's') {
        setShowSignature(true);
      } else if (!mod && (k === '+' || k === '=')) {
        stepZoom(1);
      } else if (!mod && k === '-') {
        stepZoom(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const api: PageApi = {
    tool,
    style,
    zoom,
    selected,
    editingId,
    stamp,
    select: (pageId, annId) => setSelected(annId ? { pageId, annId } : null),
    setEditing: setEditingId,
    checkpoint: history.checkpoint,
    update,
    onStampPlaced: () => {
      setStamp(null);
      setTool('select');
    },
    undo: history.undo,
    gestureAbort,
  };

  return (
    <div className="editor">
      <header className="editor-head">
        <button
          className="brand-btn"
          onClick={() => {
            if (!dirty || confirm('Perderás los cambios que no hayas descargado. ¿Salir del editor?')) onExit();
          }}
          aria-label="Volver al inicio"
        >
          <Logo />
        </button>
        <button className="icon-btn only-mobile" onClick={() => setSidebarOpen((o) => !o)} aria-label="Mostrar páginas">
          <Icon name="pages" />
        </button>
        <div className="file-name">
          <Icon name="file" size={18} />
          <input value={fileName} onChange={(e) => setFileName(e.target.value)} aria-label="Nombre del archivo" />
        </div>
        <div className="head-group">
          <button className="icon-btn" onClick={history.undo} disabled={!history.canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
            <Icon name="undo" />
          </button>
          <button className="icon-btn" onClick={history.redo} disabled={!history.canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)">
            <Icon name="redo" />
          </button>
        </div>
        <div className="head-group zoom">
          <button className="icon-btn" onClick={() => stepZoom(-1)} aria-label="Alejar">
            <Icon name="zoomOut" />
          </button>
          <button className="zoom-value" onClick={fitWidth} title="Ajustar al ancho">
            {Math.round(zoom * 100)} %
          </button>
          <button className="icon-btn" onClick={() => stepZoom(1)} aria-label="Acercar">
            <Icon name="zoomIn" />
          </button>
        </div>
        <span className="page-indicator">
          Página {Math.min(current + 1, pages.length)} de {pages.length}
        </span>
        <button className="btn btn-primary done-btn" onClick={() => setExportFormat('pdf')}>
          <Icon name="check" size={18} /> Listo
        </button>
      </header>

      <Toolbar tool={tool} onTool={chooseTool} onImage={() => imageRef.current?.click()} onSignature={() => setShowSignature(true)} />
      <PropertiesBar
        tool={tool}
        style={style}
        selected={selectedAnn}
        onStyle={onStyle}
        onDelete={deleteSelected}
        onDuplicate={duplicateSelected}
        stampPending={!!stamp}
        onCancelStamp={() => chooseTool('select')}
      />

      <div className="editor-body">
        {sidebarOpen && (
          <Sidebar
            pages={pages}
            current={current}
            onGoTo={goTo}
            onMove={movePage}
            onRotate={rotatePage}
            onDuplicate={duplicatePage}
            onDelete={deletePage}
            onAddBlank={addBlank}
            onInsertFiles={insertFiles}
          />
        )}
        <main
          className={`viewer${spaceHeld ? ' is-panning' : ''}`}
          ref={mainRef}
          onScroll={onScroll}
          onPointerDownCapture={onViewerPointerDown}
          onPointerMoveCapture={onViewerPointerMove}
          onPointerUpCapture={onViewerPointerUp}
          onPointerCancelCapture={onViewerPointerUp}
        >
          {pages.map((p, i) => (
            <PageView key={p.id} page={p} number={i + 1} api={api} />
          ))}
        </main>
        {wide && <AdSlot slot="editorSide" className="ad-rail" />}
      </div>
      {!wide && <AdSlot slot="editorMobile" className="ad-strip" size={[320, 50]} />}

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) onImageFile(e.target.files[0]);
          e.target.value = '';
        }}
      />

      {showSignature && (
        <SignatureModal
          onClose={() => setShowSignature(false)}
          onDone={(s) => {
            setShowSignature(false);
            setStamp(s);
            setTool('stamp');
            setSelected(null);
          }}
        />
      )}
      {exportFormat && <ExportModal pages={pages} fileName={fileName} initialFormat={exportFormat} onClose={() => setExportFormat(null)} />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
