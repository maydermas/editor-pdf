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

/**
 * Bloque de anuncio de AdSense. No muestra nada hasta que se rellene
 * `adsense.client` y el id del bloque en site.config.json.
 */
export function AdSlot({ slot }: { slot: keyof typeof ADSENSE.slots }) {
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
  if (!ADSENSE.client || !id) return null;
  return (
    <div className="ad-wrap container" aria-label="Publicidad">
      <span className="ad-label">Publicidad</span>
      <ins
        ref={ref}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE.client}
        data-ad-slot={id}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
