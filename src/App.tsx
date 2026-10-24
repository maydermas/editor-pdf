import { useEffect, useState } from 'react';
import { Home } from './components/Home';
import { Editor } from './components/Editor';
import { BRAND } from './config';
import { loadFile } from './lib/docs';
import { onLaunchFiles } from './lib/pwa';
import type { Intent, Page } from './types';

interface Session {
  pages: Page[];
  fileName: string;
  intent: Intent;
  key: number;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(
    () =>
      onLaunchFiles(async (files) => {
        const pages: Page[] = [];
        for (const f of files) pages.push(...(await loadFile(f, BRAND.maxUploadMB)));
        setSession({ pages, fileName: files.length > 1 ? 'documento-combinado.pdf' : files[0].name, intent: {}, key: Date.now() });
      }),
    [],
  );

  if (session) {
    return <Editor key={session.key} initialPages={session.pages} fileName={session.fileName} intent={session.intent} onExit={() => setSession(null)} />;
  }
  return <Home onOpen={(pages, fileName, intent) => setSession({ pages, fileName, intent, key: Date.now() })} />;
}
