import { useEffect, useRef, useState } from 'react';
import type { Annotation, FontFamily, Tool, ToolStyle } from '../types';
import { Icon } from './Icon';

interface ToolDef {
  id: Tool;
  label: string;
  icon: string;
  key?: string;
}

const MAIN: ToolDef[] = [
  { id: 'select', label: 'Seleccionar', icon: 'select', key: 'V' },
  { id: 'text', label: 'Texto', icon: 'text', key: 'T' },
  { id: 'draw', label: 'Dibujar', icon: 'draw', key: 'P' },
  { id: 'highlight', label: 'Resaltar', icon: 'highlight', key: 'H' },
  { id: 'whiteout', label: 'Tapar', icon: 'whiteout', key: 'E' },
];
const SHAPES: ToolDef[] = [
  { id: 'rect', label: 'Rectángulo', icon: 'rect', key: 'R' },
  { id: 'ellipse', label: 'Elipse', icon: 'ellipse', key: 'O' },
  { id: 'line', label: 'Línea', icon: 'line', key: 'L' },
  { id: 'arrow', label: 'Flecha', icon: 'arrow', key: 'A' },
];
const MARKS: ToolDef[] = [
  { id: 'check', label: 'Marca ✓', icon: 'check' },
  { id: 'cross', label: 'Cruz ✗', icon: 'cross' },
  { id: 'dot', label: 'Punto', icon: 'dot' },
];
const AFTER: ToolDef[] = [
  { id: 'note', label: 'Nota', icon: 'note', key: 'N' },
  { id: 'date', label: 'Fecha', icon: 'date', key: 'D' },
];

export const SHORTCUTS: Record<string, Tool> = Object.fromEntries(
  [...MAIN, ...SHAPES, ...AFTER].filter((t) => t.key).map((t) => [t.key!.toLowerCase(), t.id]),
);

const COLORS = ['#111827', '#DC2626', '#2563EB', '#16A34A', '#F59E0B', '#7C3AED', '#FDE047', '#FFFFFF'];

function Group({ label, icon, tools, tool, onTool }: { label: string; icon: string; tools: ToolDef[]; tool: Tool; onTool: (t: Tool) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = tools.find((t) => t.id === tool);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="tool-group" ref={ref}>
      <button className={`tool${active ? ' is-active' : ''}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title={label}>
        <Icon name={active?.icon ?? icon} />
        <span>{active?.label ?? label}</span>
        <Icon name="chevron" size={12} className="chev" />
      </button>
      {open && (
        <div className="menu" role="menu">
          {tools.map((t) => (
            <button
              key={t.id}
              role="menuitem"
              className={`menu-item${tool === t.id ? ' is-active' : ''}`}
              onClick={() => {
                onTool(t.id);
                setOpen(false);
              }}
            >
              <Icon name={t.icon} size={18} /> {t.label}
              {t.key && <kbd>{t.key}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  tool: Tool;
  onTool: (t: Tool) => void;
  onImage: () => void;
  onSignature: () => void;
}

export function Toolbar({ tool, onTool, onImage, onSignature }: Props) {
  const btn = (t: ToolDef) => (
    <button key={t.id} className={`tool${tool === t.id ? ' is-active' : ''}`} onClick={() => onTool(t.id)} title={t.key ? `${t.label} (${t.key})` : t.label} aria-pressed={tool === t.id}>
      <Icon name={t.icon} />
      <span>{t.label}</span>
    </button>
  );
  return (
    <div className="toolbar" role="toolbar" aria-label="Herramientas">
      {MAIN.map(btn)}
      <Group label="Formas" icon="shapes" tools={SHAPES} tool={tool} onTool={onTool} />
      <span className="tool-sep" />
      {AFTER.map(btn)}
      <Group label="Marcas" icon="marks" tools={MARKS} tool={tool} onTool={onTool} />
      <button className="tool" onClick={onImage} title="Insertar imagen">
        <Icon name="image" />
        <span>Imagen</span>
      </button>
      <button className={`tool tool-accent${tool === 'stamp' ? ' is-active' : ''}`} onClick={onSignature} title="Firmar">
        <Icon name="signature" />
        <span>Firmar</span>
      </button>
    </div>
  );
}

interface PropsBar {
  tool: Tool;
  style: ToolStyle;
  selected: Annotation | null;
  onStyle: (patch: Partial<ToolStyle>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  stampPending: boolean;
  onCancelStamp: () => void;
}

const usesColor = (t: Tool | Annotation['type']) => !['select', 'whiteout', 'stamp', 'image', 'note'].includes(t);
const usesWidth = (t: Tool | Annotation['type']) => ['draw', 'ink', 'rect', 'ellipse', 'line', 'arrow'].includes(t);
const usesFont = (t: Tool | Annotation['type']) => ['text', 'date'].includes(t);

export function PropertiesBar({ tool, style, selected, onStyle, onDelete, onDuplicate, stampPending, onCancelStamp }: PropsBar) {
  if (stampPending) {
    return (
      <div className="propbar">
        <span className="hint">Haz clic en la página donde quieras colocar el elemento.</span>
        <button className="btn btn-ghost btn-sm" onClick={onCancelStamp}>
          Cancelar
        </button>
      </div>
    );
  }
  const subject: Tool | Annotation['type'] = selected ? selected.type : tool;
  const color = selected && 'color' in selected ? selected.color : style.color;
  const width = selected && 'width' in selected ? selected.width : style.width;
  const font = selected?.type === 'text' ? selected : style;
  const showColor = usesColor(subject);
  const showWidth = usesWidth(subject);
  const showFont = usesFont(subject);
  const isMark = subject === 'mark' || ['check', 'cross', 'dot'].includes(subject);

  if (!showColor && !showWidth && !showFont && !selected) {
    return (
      <div className="propbar">
        <span className="hint">
          {tool === 'select'
            ? 'Selecciona un elemento para moverlo o cambiar su tamaño. Doble clic para editar texto.'
            : tool === 'whiteout'
              ? 'Arrastra sobre la zona que quieras tapar con blanco.'
              : 'Haz clic en la página para añadir una nota.'}
        </span>
      </div>
    );
  }

  return (
    <div className="propbar">
      {showColor && (
        <div className="prop" role="radiogroup" aria-label="Color">
          {COLORS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={color.toLowerCase() === c.toLowerCase()}
              aria-label={`Color ${c}`}
              className={`swatch${color.toLowerCase() === c.toLowerCase() ? ' is-active' : ''}`}
              style={{ background: c }}
              onClick={() => onStyle({ color: c })}
            />
          ))}
          <label className="swatch swatch-custom" title="Otro color">
            <input type="color" value={color} onChange={(e) => onStyle({ color: e.target.value })} aria-label="Otro color" />
          </label>
        </div>
      )}
      {showWidth && (
        <label className="prop">
          <span>Grosor</span>
          <input type="range" min={0.5} max={12} step={0.5} value={width} onChange={(e) => onStyle({ width: Number(e.target.value) })} />
          <span className="num">{width}</span>
        </label>
      )}
      {(showFont || isMark) && (
        <label className="prop">
          <span>Tamaño</span>
          <select
            className="select"
            value={selected?.type === 'mark' ? Math.round(selected.size / 1.1) : font.fontSize}
            onChange={(e) => onStyle({ fontSize: Number(e.target.value) })}
          >
            {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      )}
      {showFont && (
        <>
          <label className="prop">
            <span className="sr-only">Fuente</span>
            <select className="select" value={font.font} onChange={(e) => onStyle({ font: e.target.value as FontFamily })}>
              <option value="helvetica">Sans (Helvetica)</option>
              <option value="times">Serif (Times)</option>
              <option value="courier">Mono (Courier)</option>
            </select>
          </label>
          <div className="prop">
            <button className={`icon-btn${font.bold ? ' is-active' : ''}`} aria-pressed={font.bold} aria-label="Negrita" onClick={() => onStyle({ bold: !font.bold })}>
              <Icon name="bold" size={18} />
            </button>
            <button className={`icon-btn${font.italic ? ' is-active' : ''}`} aria-pressed={font.italic} aria-label="Cursiva" onClick={() => onStyle({ italic: !font.italic })}>
              <Icon name="italic" size={18} />
            </button>
          </div>
        </>
      )}
      {selected && (
        <div className="prop prop-end">
          <button className="btn btn-ghost btn-sm" onClick={onDuplicate}>
            <Icon name="copy" size={16} /> Duplicar
          </button>
          <button className="btn btn-ghost btn-sm danger" onClick={onDelete}>
            <Icon name="trash" size={16} /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
