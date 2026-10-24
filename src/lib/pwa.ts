import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('No se pudo activar el modo sin conexión', e));
  });
}

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallEvent;
  listeners.forEach((l) => l());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((l) => l());
});

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Estado del botón «Instalar app»: `prompt` cuando el navegador ofrece instalar,
 * `ios` cuando hay que hacerlo a mano desde Compartir, `null` si no aplica.
 */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (isStandalone()) return { mode: null as null, install: async () => {} };
  if (deferred)
    return {
      mode: 'prompt' as const,
      install: async () => {
        const ev = deferred;
        if (!ev) return;
        await ev.prompt();
        await ev.userChoice;
        deferred = null;
        force((n) => n + 1);
      },
    };
  if (isIos()) return { mode: 'ios' as const, install: async () => {} };
  return { mode: null as null, install: async () => {} };
}

interface LaunchParams {
  files: { getFile: () => Promise<File> }[];
}

/** Archivos abiertos con «Abrir con → Editor PDF» desde el sistema (Chrome/Edge en escritorio). */
export function onLaunchFiles(cb: (files: File[]) => void) {
  const lq = (window as { launchQueue?: { setConsumer: (fn: (p: LaunchParams) => void) => void } }).launchQueue;
  lq?.setConsumer(async (params) => {
    if (!params.files?.length) return;
    cb(await Promise.all(params.files.map((h) => h.getFile())));
  });
}
