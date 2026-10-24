import { useEffect, useRef } from 'react';
import { ADSENSE } from '../config';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptAdded = false;
function loadAdsense() {
  if (scriptAdded || !ADSENSE.client) return;
  scriptAdded = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE.client}`;
  document.head.appendChild(s);
}

/** Con `?anuncios=demo` en la dirección se ven cajas grises donde irán los anuncios. */
const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('anuncios') === 'demo';

/**
 * Bloque de anuncio de AdSense. No muestra nada hasta que se rellene
 * `adsense.client` y el id del bloque en site.config.json.
 */
export function AdSlot({
  slot,
  className = 'container',
  size,
}: {
  slot: keyof typeof ADSENSE.slots;
  className?: string;
  /** Tamaño fijo en píxeles (ancho, alto). Sin él, el anuncio es adaptable. */
  size?: [number, number];
}) {
  const ref = useRef<HTMLModElement>(null);
  const id = ADSENSE.slots[slot];
  useEffect(() => {
    if (!ADSENSE.client || !id || !ref.current || ref.current.dataset.adsbygoogleStatus) return;
    loadAdsense();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* el bloqueador de anuncios puede impedirlo */
    }
  }, [id]);
  if (!ADSENSE.client || !id) {
    if (!DEMO) return null;
    return (
      <div className={`ad-wrap ${className}`} aria-label="Publicidad">
        <span className="ad-label">Publicidad</span>
        <div className="ad-demo" style={size && { width: size[0], height: size[1], minHeight: 0 }}>
          Anuncio «{slot}»
        </div>
      </div>
    );
  }
  return (
    <div className={`ad-wrap ${className}`} aria-label="Publicidad">
      <span className="ad-label">Publicidad</span>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={size ? { display: 'inline-block', width: size[0], height: size[1] } : { display: 'block' }}
        data-ad-client={ADSENSE.client}
        data-ad-slot={id}
        {...(size ? {} : { 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' })}
      />
    </div>
  );
}
