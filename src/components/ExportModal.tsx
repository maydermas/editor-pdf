import { useState } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { AdSlot } from './AdSlot';
import { parsePageRanges } from '../lib/pageRange';
import { downloadBlob, exportDocument, type ExportResult } from '../lib/export';
import type { ExportFormat, Page } from '../types';

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'pdf', label: 'PDF', hint: 'Conserva texto y calidad' },
  { id: 'pdf-compressed', label: 'PDF comprimido', hint: 'Menos peso, páginas como imagen' },
  { id: 'jpg', label: 'JPG', hint: 'Una imagen por página' },
  { id: 'png', label: 'PNG', hint: 'Imagen sin pérdida' },
];

type Phase = { kind: 'form' } | { kind: 'working'; msg: string } | { kind: 'done'; result: ExportResult } | { kind: 'error'; msg: string };

export function ExportModal({ pages, fileName, initialFormat = 'pdf', onClose }: { pages: Page[]; fileName: string; initialFormat?: ExportFormat; onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [range, setRange] = useState('');
  const [split, setSplit] = useState(false);
  // Con otro nombre que el original: en el móvil es fácil abrir el archivo antiguo creyendo que es el nuevo.
  const [name, setName] = useState(editedName(fileName));
  const [quality, setQuality] = useState(0.7);
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });

  const parsed = parsePageRanges(range, pages.length);
  const rangeError = 'error' in parsed ? parsed.error : null;
  const count = 'groups' in parsed ? parsed.groups.flat().length : 0;
  const lossy = format === 'jpg' || format === 'pdf-compressed';

  const run = async () => {
    if (!('groups' in parsed)) return;
    setPhase({ kind: 'working', msg: 'Preparando…' });
    try {
      const result = await exportDocument(pages, {
        format,
        groups: parsed.groups,
        split,
        fileName: name || 'documento',
        quality,
        onProgress: (msg) => setPhase({ kind: 'working', msg }),
      });
      // En el móvil se descarga o comparte al pulsar (iOS no deja descargar sin un toque del usuario).
      if (!isMobile()) downloadBlob(result);
      setPhase({ kind: 'done', result });
    } catch (e) {
      console.error(e);
      setPhase({ kind: 'error', msg: (e as Error).message || 'Error desconocido' });
    }
  };

  return (
    <Modal title="Descargar documento" onClose={onClose} width={520}>
      {phase.kind === 'form' && (
        <form
          className="export-form"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <fieldset>
            <legend>Formato</legend>
            <div className="format-grid">
              {FORMATS.map((f) => (
                <label key={f.id} className={`format-card${format === f.id ? ' is-active' : ''}`}>
                  <input type="radio" name="format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} />
                  <strong>{f.label}</strong>
                  <span>{f.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>Páginas</span>
            <input
              className={`input${rangeError ? ' is-invalid' : ''}`}
              placeholder={`Todas (1-${pages.length}). Ejemplo: 1-3,5`}
              value={range}
              onChange={(e) => setRange(e.target.value)}
              aria-invalid={!!rangeError}
            />
            <small className={rangeError ? 'error-text' : 'muted'}>
              {rangeError ?? 'Separa los rangos con comas o espacios. La numeración empieza en 1.'}
            </small>
          </label>

          <label className="check">
            <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
            <span>Un archivo por cada rango (dividir PDF, se descarga en ZIP)</span>
          </label>

          {lossy && (
            <label className="field">
              <span>Calidad de imagen: {Math.round(quality * 100)} %</span>
              <input type="range" min={0.3} max={0.95} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
            </label>
          )}

          <label className="field">
            <span>Nombre del archivo</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!!rangeError || count === 0}>
              <Icon name="download" size={18} /> Descargar {count} página{count === 1 ? '' : 's'}
            </button>
          </div>
        </form>
      )}

      {phase.kind === 'working' && (
        <div className="export-status" role="status">
          <div className="spinner" />
          <p>{phase.msg}</p>
        </div>
      )}

      {phase.kind === 'done' && (
        <div className="export-status">
          <div className="done-badge">
            <Icon name="check" size={28} />
          </div>
          <p>
            <strong>{phase.result.fileName}</strong> está listo con tus cambios ({(phase.result.blob.size / 1024).toFixed(0)} KB).
          </p>
          {isMobile() ? (
            <div className="modal-actions modal-actions-stack">
              {canShare(phase.result) && (
                <button className="btn btn-primary" onClick={() => shareResult(phase.result)}>
                  <Icon name="download" size={18} /> Guardar o compartir
                </button>
              )}
              <button className={`btn ${canShare(phase.result) ? 'btn-ghost' : 'btn-primary'}`} onClick={() => downloadBlob(phase.result)}>
                Descargar
              </button>
              <button className="btn btn-ghost" onClick={() => openResult(phase.result)}>
                Ver el archivo
              </button>
              <button className="btn btn-ghost" onClick={onClose}>
                Seguir editando
              </button>
            </div>
          ) : (
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => downloadBlob(phase.result)}>
                Descargar de nuevo
              </button>
              <button className="btn btn-primary" onClick={onClose}>
                Seguir editando
              </button>
            </div>
          )}
          <AdSlot slot="exportDone" className="ad-modal" />
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="export-status">
          <p className="error-text">No se pudo generar el archivo: {phase.msg}</p>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => setPhase({ kind: 'form' })}>
              Volver
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** «contrato.pdf» → «contrato-editado». */
export function editedName(fileName: string) {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '');
  return /-editado$/i.test(base) ? base : `${base}-editado`;
}

const isMobile = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const asFile = (r: ExportResult) => new File([r.blob], r.fileName, { type: r.blob.type });

function canShare(r: ExportResult) {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [asFile(r)] });
  } catch {
    return false;
  }
}

/** Menú de compartir del sistema: en el iPhone permite «Guardar en Archivos», WhatsApp, correo… */
function shareResult(r: ExportResult) {
  navigator.share({ files: [asFile(r)] }).catch((e: Error) => {
    if (e.name !== 'AbortError') downloadBlob(r);
  });
}

function openResult(r: ExportResult) {
  const url = URL.createObjectURL(r.blob);
  if (!window.open(url, '_blank')) location.assign(url);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
