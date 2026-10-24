import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import type { Stamp } from './PageView';

type Tab = 'draw' | 'type' | 'upload';
const INKS = ['#111827', '#1D4ED8', '#B91C1C'];
const SCRIPT_FONTS = ['"Segoe Script", "Brush Script MT", cursive', '"Lucida Handwriting", "Apple Chancery", cursive', 'Georgia, serif'];
const STORAGE_KEY = 'editor-pdf:firmas';

/** Recorta los bordes transparentes de un lienzo y devuelve un PNG. */
function trimCanvas(src: HTMLCanvasElement): { url: string; w: number; h: number } | null {
  const ctx = src.getContext('2d')!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const pad = 6;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { url: out.toDataURL('image/png'), w: out.width, h: out.height };
}

const loadSaved = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

/** Tamaño de colocación por defecto: unos 160 pt de ancho. */
function toStamp(url: string, w: number, h: number): Stamp {
  const targetW = Math.min(180, w);
  return { src: url, w: targetW, h: (h * targetW) / w, signature: true };
}

export function SignatureModal({ onClose, onDone }: { onClose: () => void; onDone: (s: Stamp) => void }) {
  const [tab, setTab] = useState<Tab>('draw');
  const [ink, setInk] = useState(INKS[0]);
  const [name, setName] = useState('');
  const [fontIdx, setFontIdx] = useState(0);
  const [saved, setSaved] = useState<string[]>(loadSaved);
  const [hasInk, setHasInk] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<[number, number] | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || tab !== 'draw') return;
    const ratio = 2;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    setHasInk(false);
  }, [tab]);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const finish = (url: string, w: number, h: number) => {
    const next = [url, ...saved.filter((s) => s !== url)].slice(0, 3);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* el almacenamiento es opcional */
    }
    setSaved(next);
    onDone(toStamp(url, w / 2, h / 2));
  };

  const confirm = () => {
    if (tab === 'draw') {
      const t = trimCanvas(canvasRef.current!);
      if (t) finish(t.url, t.w, t.h);
    } else if (tab === 'type') {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d')!;
      const font = `96px ${SCRIPT_FONTS[fontIdx]}`;
      ctx.font = font;
      c.width = Math.ceil(ctx.measureText(name).width) + 40;
      c.height = 150;
      ctx.font = font;
      ctx.fillStyle = ink;
      ctx.textBaseline = 'middle';
      ctx.fillText(name, 20, 75);
      const t = trimCanvas(c);
      if (t) finish(t.url, t.w, t.h);
    }
  };

  const onUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Se normaliza a PNG para conservar la transparencia.
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        finish(c.toDataURL('image/png'), c.width, c.height);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal title="Crear firma" onClose={onClose} width={560}>
      {saved.length > 0 && (
        <div className="saved-sigs">
          <span className="muted">Firmas recientes</span>
          <div className="saved-sigs-row">
            {saved.map((s) => (
              <button
                key={s}
                className="saved-sig"
                onClick={() => {
                  const img = new Image();
                  img.onload = () => onDone(toStamp(s, img.naturalWidth / 2, img.naturalHeight / 2));
                  img.src = s;
                }}
              >
                <img src={s} alt="Firma guardada" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="tabs" role="tablist">
        {(
          [
            ['draw', 'Dibujar'],
            ['type', 'Escribir'],
            ['upload', 'Subir imagen'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab !== 'upload' && (
        <div className="ink-row">
          {INKS.map((c) => (
            <button key={c} className={`swatch${ink === c ? ' is-active' : ''}`} style={{ background: c }} aria-label={`Tinta ${c}`} onClick={() => setInk(c)} />
          ))}
        </div>
      )}

      {tab === 'draw' && (
        <div className="sig-pad">
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              drawing.current = point(e);
            }}
            onPointerMove={(e) => {
              if (!drawing.current) return;
              const ctx = canvasRef.current!.getContext('2d')!;
              const [x, y] = point(e);
              ctx.strokeStyle = ink;
              ctx.lineWidth = 2.6;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              ctx.moveTo(...drawing.current);
              ctx.lineTo(x, y);
              ctx.stroke();
              drawing.current = [x, y];
              setHasInk(true);
            }}
            onPointerUp={() => (drawing.current = null)}
          />
          <span className="sig-line">Firma aquí</span>
          <button
            className="btn btn-ghost btn-sm sig-clear"
            onClick={() => {
              const c = canvasRef.current!;
              c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
              setHasInk(false);
            }}
          >
            Borrar
          </button>
        </div>
      )}

      {tab === 'type' && (
        <div className="sig-type">
          <input className="input" placeholder="Escribe tu nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="sig-fonts">
            {SCRIPT_FONTS.map((f, i) => (
              <button key={f} className={`sig-font${fontIdx === i ? ' is-active' : ''}`} style={{ fontFamily: f, color: ink }} onClick={() => setFontIdx(i)}>
                {name || 'Tu firma'}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'upload' && (
        <label className="dropzone dropzone-sm">
          <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
          <span>Elige una imagen de tu firma (PNG con fondo transparente o JPG)</span>
        </label>
      )}

      {tab !== 'upload' && (
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={tab === 'draw' ? !hasInk : !name.trim()} onClick={confirm}>
            Usar firma
          </button>
        </div>
      )}
    </Modal>
  );
}
