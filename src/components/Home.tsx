import { useRef, useState } from 'react';
import { BRAND } from '../config';
import { ACCEPTED, LoadError, createBlankPage, loadFile } from '../lib/docs';
import type { Intent, Page } from '../types';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { useInstall } from '../lib/pwa';
import { AdSlot } from './AdSlot';

interface ToolCard {
  label: string;
  icon: string;
  desc: string;
  intent?: Intent;
  blank?: boolean;
}

/** Herramientas sin `intent` necesitan un servidor y se muestran como «Próximamente». */
const CATALOG: Record<string, ToolCard[]> = {
  'Editar y firmar': [
    { label: 'Editar PDF', icon: 'text', desc: 'Añade texto, imágenes y formas.', intent: { tool: 'text' } },
    { label: 'Firmar PDF', icon: 'signature', desc: 'Dibuja, escribe o sube tu firma.', intent: { openSignature: true } },
    { label: 'Anotar PDF', icon: 'highlight', desc: 'Resalta, subraya y deja notas.', intent: { tool: 'highlight' } },
    { label: 'Rellenar PDF', icon: 'form', desc: 'Completa formularios con texto y marcas.', intent: { tool: 'text' } },
    { label: 'Combinar PDF', icon: 'merge', desc: 'Sube varios archivos y únelos en uno.', intent: {} },
    { label: 'Dividir PDF', icon: 'split', desc: 'Separa rangos de páginas en archivos.', intent: { exportFormat: 'pdf' } },
    { label: 'Girar PDF', icon: 'rotateR', desc: 'Rota páginas sueltas o todas.', intent: {} },
    { label: 'Eliminar páginas', icon: 'trash', desc: 'Quita las páginas que sobran.', intent: {} },
    { label: 'Extraer páginas', icon: 'pages', desc: 'Guarda solo las páginas elegidas.', intent: { exportFormat: 'pdf' } },
    { label: 'Comprimir PDF', icon: 'compress', desc: 'Reduce el peso del archivo.', intent: { exportFormat: 'pdf-compressed' } },
    { label: 'Crear PDF', icon: 'plus', desc: 'Empieza desde una página en blanco.', blank: true },
    { label: 'Imagen a texto (OCR)', icon: 'sparkle', desc: 'Reconoce texto en escaneos.' },
    { label: 'Resumir PDF con IA', icon: 'sparkle', desc: 'Obtén las ideas clave al momento.' },
  ],
  'Convertir desde PDF': [
    { label: 'PDF a JPG', icon: 'image', desc: 'Una imagen JPG por página.', intent: { exportFormat: 'jpg' } },
    { label: 'PDF a PNG', icon: 'image', desc: 'Imágenes PNG sin pérdida.', intent: { exportFormat: 'png' } },
    { label: 'PDF a Word', icon: 'convert', desc: 'Documento editable .docx.' },
    { label: 'PDF a Excel', icon: 'convert', desc: 'Tablas a hoja de cálculo.' },
    { label: 'PDF a PowerPoint', icon: 'convert', desc: 'Diapositivas .pptx.' },
    { label: 'PDF a texto', icon: 'convert', desc: 'Texto plano .txt.' },
  ],
  'Convertir a PDF': [
    { label: 'JPG a PDF', icon: 'image', desc: 'Convierte fotos en un PDF.', intent: {} },
    { label: 'PNG a PDF', icon: 'image', desc: 'Convierte imágenes en un PDF.', intent: {} },
    { label: 'Word a PDF', icon: 'convert', desc: 'De .docx a PDF.' },
    { label: 'Excel a PDF', icon: 'convert', desc: 'De .xlsx a PDF.' },
    { label: 'PowerPoint a PDF', icon: 'convert', desc: 'De .pptx a PDF.' },
    { label: 'HTML a PDF', icon: 'convert', desc: 'Páginas web a PDF.' },
  ],
};

const FEATURES = [
  { icon: 'text', title: 'Edita texto sin complicaciones', body: 'Escribe sobre cualquier página, cambia fuente, tamaño y color, y tapa lo que ya no sirva.' },
  { icon: 'pages', title: 'Todo en un mismo sitio', body: 'Anota, firma, organiza páginas, combina archivos y exporta sin cambiar de herramienta.' },
  { icon: 'bolt', title: 'Rápido y sin instalar nada', body: 'Funciona en el navegador de tu ordenador, tableta o móvil.' },
  { icon: 'lock', title: 'Tus archivos no salen de tu equipo', body: 'El documento se procesa en tu navegador. No se sube a ningún servidor.' },
  { icon: 'signature', title: 'Firma en segundos', body: 'Dibuja, escribe o sube tu firma y colócala donde la necesites.' },
  { icon: 'convert', title: 'Exporta como quieras', body: 'Descarga en PDF, PDF comprimido, JPG o PNG, completo o por rangos de páginas.' },
];

const FAQ = [
  ['¿Cómo edito un PDF?', 'Sube el archivo, elige una herramienta en la barra superior (texto, dibujo, resaltado, formas, firma…) y haz clic en la página. Cuando termines, pulsa «Listo», elige el formato y descarga.'],
  ['¿Es gratis? ¿Hay que registrarse?', 'Es gratis y no hace falta cuenta. La web se mantiene con publicidad.'],
  ['¿Es seguro?', 'Sí. Todo el procesamiento ocurre en tu navegador: el archivo no se envía a ningún servidor y desaparece al cerrar la pestaña.'],
  ['¿Qué archivos puedo abrir?', `PDF, PNG y JPG de hasta ${BRAND.maxUploadMB} MB. Las imágenes se convierten en páginas PDF.`],
  ['¿Puedo cambiar el orden de las páginas?', 'Sí. En el panel de miniaturas puedes arrastrarlas, girarlas, duplicarlas, borrarlas y añadir páginas en blanco u otros archivos.'],
  ['¿Cómo divido o extraigo páginas?', 'Pulsa «Listo», escribe los rangos (por ejemplo 1-3,5) y marca «Un archivo por cada rango» si quieres archivos separados.'],
  ['¿Se puede deshacer?', 'Sí, con los botones de la cabecera o con Ctrl+Z y Ctrl+Shift+Z.'],
];

/** Vuelve a mostrar el aviso de consentimiento de Google (si AdSense está activo). */
function openPrivacyChoices(e: React.MouseEvent) {
  e.preventDefault();
  const w = window as unknown as { googlefc?: { callbackQueue?: (() => void)[]; showRevocationMessage?: () => void } };
  w.googlefc = w.googlefc || {};
  w.googlefc.callbackQueue = w.googlefc.callbackQueue || [];
  w.googlefc.callbackQueue.push(() => w.googlefc?.showRevocationMessage?.());
}

interface Props {
  onOpen: (pages: Page[], fileName: string, intent: Intent) => void;
}

export function Home({ onOpen }: Props) {
  const [tab, setTab] = useState(Object.keys(CATALOG)[0]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingIntent = useRef<Intent>({});
  const install = useInstall();
  const [iosHelp, setIosHelp] = useState(false);

  const open = async (files: FileList | File[], intent: Intent = pendingIntent.current) => {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    setError(null);
    try {
      const pages: Page[] = [];
      for (const f of list) pages.push(...(await loadFile(f, BRAND.maxUploadMB)));
      const name = list.length > 1 ? 'documento-combinado.pdf' : list[0].name.replace(/\.(png|jpe?g)$/i, '.pdf');
      onOpen(pages, name, intent);
    } catch (e) {
      setError(e instanceof LoadError ? e.message : 'No se pudo abrir el archivo.');
    } finally {
      setBusy(false);
      pendingIntent.current = {};
    }
  };

  const pick = (intent: Intent = {}) => {
    pendingIntent.current = intent;
    inputRef.current?.click();
  };

  const startBlank = async () => onOpen([await createBlankPage()], 'documento-nuevo.pdf', { tool: 'text' });

  return (
    <div className="home">
      <header className="site-head">
        <div className="container site-head-row">
          <Logo />
          <nav className="site-nav" aria-label="Principal">
            <a href="#herramientas" onClick={() => setTab('Editar y firmar')}>
              Editar y firmar
            </a>
            <a href="#herramientas" onClick={() => setTab('Convertir desde PDF')}>
              Convertir
            </a>
            <a href="./guias/">Guías</a>
            <a href="./contacto/">Contacto</a>
          </nav>
          <div className="head-actions">
            {install.mode && (
              <button className="btn btn-ghost btn-sm" onClick={() => (install.mode === 'ios' ? setIosHelp((v) => !v) : install.install())}>
                <Icon name="download" size={16} /> Instalar app
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => pick()}>
              Subir PDF
            </button>
          </div>
        </div>
      </header>

      {iosHelp && (
        <div className="install-help container" role="note">
          Para instalarla en iPhone o iPad: pulsa <strong>Compartir</strong> en Safari y luego <strong>Añadir a pantalla de inicio</strong>.
          <button className="link-btn" onClick={() => setIosHelp(false)}>
            Entendido
          </button>
        </div>
      )}

      <section className="hero">
        <div className="container">
          <h1>Editor de PDF en línea para todo lo que necesitas</h1>
          <p className="lead">Edita, firma, anota y organiza tus documentos desde el navegador, cuando y donde quieras.</p>
          <div
            className={`dropzone${dragging ? ' is-drag' : ''}${busy ? ' is-busy' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              open(e.dataTransfer.files, {});
            }}
            onClick={() => !busy && pick()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick()}
            aria-label="Subir archivos"
          >
            {busy ? (
              <>
                <div className="spinner" />
                <p>Abriendo documento…</p>
              </>
            ) : (
              <>
                <div className="dz-icon">
                  <Icon name="upload" size={30} />
                </div>
                <p className="dz-title">Suelta aquí tus archivos</p>
                <p className="muted">PDF, PNG o JPG · hasta {BRAND.maxUploadMB} MB · varios archivos se combinan</p>
                <span className="btn btn-primary btn-lg">
                  <Icon name="plus" size={20} /> Elegir archivo
                </span>
              </>
            )}
          </div>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button className="link-btn" onClick={startBlank}>
            o empieza con un documento en blanco
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            hidden
            data-testid="file-input"
            onChange={(e) => {
              if (e.target.files) open(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </section>

      <section className="section" id="herramientas">
        <div className="container">
          <h2>Mucho más que editar PDF</h2>
          <div className="tabs tabs-center" role="tablist">
            {Object.keys(CATALOG).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`tab${tab === t ? ' is-active' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="tool-grid">
            {CATALOG[tab].map((c) => {
              const soon = !c.intent && !c.blank;
              return (
                <button
                  key={c.label}
                  className={`tool-card${soon ? ' is-soon' : ''}`}
                  disabled={soon}
                  onClick={() => (c.blank ? startBlank() : pick(c.intent))}
                >
                  <span className="tool-card-icon">
                    <Icon name={c.icon} size={22} />
                  </span>
                  <strong>{c.label}</strong>
                  <span>{c.desc}</span>
                  {soon && <em className="badge">Próximamente</em>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <AdSlot slot="homeTop" />

      <section className="section section-alt">
        <div className="container">
          <h2>¿Por qué usar {BRAND.name}?</h2>
          <div className="features">
            {FEATURES.map((f) => (
              <div className="feature" key={f.title}>
                <span className="tool-card-icon">
                  <Icon name={f.icon} size={22} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section cta">
        <div className="container cta-box">
          <h2>Edita tu PDF en segundos</h2>
          <button className="btn btn-light btn-lg" onClick={() => pick()}>
            <Icon name="upload" size={20} /> Subir archivo
          </button>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="container narrow">
          <h2>Preguntas frecuentes</h2>
          <div className="faq">
            {FAQ.map(([q, a], i) => (
              <div className={`faq-item${openFaq === i ? ' is-open' : ''}`} key={q}>
                <button className="faq-q" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {q}
                  <Icon name="chevron" size={18} />
                </button>
                {openFaq === i && <p className="faq-a">{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <AdSlot slot="homeBottom" />

      <footer className="site-foot">
        <div className="container foot-row">
          <Logo />
          <span className="muted">
            © {new Date().getFullYear()} {BRAND.name}. Tus documentos se procesan en tu navegador.
          </span>
          <nav className="foot-links" aria-label="Información">
            <a href="./guias/">Guías</a>
            <a href="./sobre-nosotros/">Sobre nosotros</a>
            <a href="./contacto/">Contacto</a>
            <a href="./aviso-legal/">Aviso legal</a>
            <a href="./politica-de-privacidad/">Privacidad</a>
            <a href="./politica-de-cookies/">Cookies</a>
            <a href="#" onClick={openPrivacyChoices}>
              Preferencias de privacidad
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
