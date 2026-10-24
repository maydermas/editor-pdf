import { useRef, useState } from 'react';
import type { Page } from '../types';
import { PageCanvas } from './PageCanvas';
import { AnnotationLayer } from './AnnotationSvg';
import { Icon } from './Icon';

const THUMB_W = 116;

interface Props {
  pages: Page[];
  current: number;
  onGoTo: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onRotate: (index: number, dir: 1 | -1) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  onAddBlank: () => void;
  onInsertFiles: (files: FileList) => void;
}

export function Sidebar(p: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="sidebar" aria-label="Páginas">
      <div className="sidebar-head">
        <span>Páginas</span>
        <span className="muted">{p.pages.length}</span>
      </div>
      <ol className="thumbs">
        {p.pages.map((page, i) => {
          const swapped = page.rotation % 180 !== 0;
          const scale = THUMB_W / (swapped ? page.height : page.width);
          const outerH = (swapped ? page.width : page.height) * scale;
          return (
            <li
              key={page.id}
              className={`thumb${i === p.current ? ' is-current' : ''}${dropAt === i && dragFrom !== null && dragFrom !== i ? ' is-drop' : ''}`}
              draggable
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDropAt(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== i) p.onMove(dragFrom, i);
                setDragFrom(null);
                setDropAt(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDropAt(null);
              }}
            >
              <button className="thumb-btn" onClick={() => p.onGoTo(i)} aria-label={`Ir a la página ${i + 1}`}>
                <div className="thumb-frame" style={{ width: THUMB_W, height: outerH }}>
                  <div
                    className="thumb-inner"
                    style={{
                      width: page.width * scale,
                      height: page.height * scale,
                      transform: `translate(-50%, -50%) rotate(${page.rotation}deg)`,
                    }}
                  >
                    <PageCanvas page={page} scale={scale} />
                    <AnnotationLayer annotations={page.annotations} width={page.width} height={page.height} />
                  </div>
                </div>
              </button>
              <div className="thumb-meta">
                <span>{i + 1}</span>
                <div className="thumb-actions">
                  <button title="Girar a la izquierda" aria-label="Girar a la izquierda" onClick={() => p.onRotate(i, -1)}>
                    <Icon name="rotateL" size={15} />
                  </button>
                  <button title="Girar a la derecha" aria-label="Girar a la derecha" onClick={() => p.onRotate(i, 1)}>
                    <Icon name="rotateR" size={15} />
                  </button>
                  <button title="Duplicar" aria-label="Duplicar página" onClick={() => p.onDuplicate(i)}>
                    <Icon name="copy" size={15} />
                  </button>
                  <button
                    title="Eliminar"
                    aria-label="Eliminar página"
                    disabled={p.pages.length === 1}
                    onClick={() => p.onDelete(i)}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="sidebar-foot">
        <button className="btn btn-ghost btn-sm" onClick={p.onAddBlank}>
          <Icon name="plus" size={16} /> Página en blanco
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          <Icon name="merge" size={16} /> Añadir archivo
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept=".pdf,application/pdf,image/png,image/jpeg"
          onChange={(e) => {
            if (e.target.files?.length) p.onInsertFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </aside>
  );
}
