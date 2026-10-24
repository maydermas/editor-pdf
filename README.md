# Editor PDF

Editor de PDF propio que funciona entero en el navegador (sin servidor). Inspirado en la funcionalidad pública
de un editor PDF en línea, con diseño, textos, logotipo e iconos propios.

## Funciones

- **Subir**: arrastrar y soltar o elegir archivo; PDF, PNG y JPG hasta 100 MB (`src/config.ts`). Varios archivos se combinan.
- **Editar**: texto (fuente, tamaño, color, negrita, cursiva), fecha, dibujo a mano alzada, resaltado, tapar con blanco,
  rectángulo, elipse, línea, flecha, marcas ✓ ✗ •, notas adhesivas (comentarios PDF reales), imágenes y firma
  (dibujada, escrita o subida; guarda las 3 últimas en el navegador).
- **Seleccionar**: mover, redimensionar, duplicar, eliminar, copiar/pegar, mover con flechas.
- **Páginas**: miniaturas, reordenar arrastrando, girar, duplicar, eliminar, página en blanco, añadir otro archivo.
- **Deshacer/rehacer**, zoom (botones, Ctrl+rueda, ajustar al ancho), indicador de página.
- **Listo → Descargar**: PDF, PDF comprimido (rasterizado JPEG), JPG o PNG; rangos tipo `1-3,5`; un archivo por rango
  (dividir/extraer) en ZIP.

Atajos: V seleccionar, T texto, P dibujar, H resaltar, E tapar, R/O/L/A formas, N nota, D fecha, S firma,
Ctrl+Z / Ctrl+Shift+Z, Supr, Esc, +/−.

## Pendiente (necesita servidor)

Conversión a/desde Word, Excel y PowerPoint, OCR y resúmenes con IA aparecen en la portada como «Próximamente».
No hay cuentas ni pagos: la web es gratuita y sin registro, financiada con publicidad.

## Aplicación instalable (PWA)

La app se instala desde el navegador y funciona sin conexión (manifest + service worker generado en
`scripts/generate-sw.mjs`). En Chrome/Edge de escritorio también se puede usar «Abrir con → Editor PDF» sobre un PDF.
Necesita estar publicada en HTTPS:

- **Rápido:** `npm run build` y arrastra la carpeta `dist/` a https://app.netlify.com/drop
- **GitHub Pages:** sube el repositorio y activa Settings → Pages → Source: GitHub Actions (ya incluye `.github/workflows/pages.yml`).

Instalar: en Android/Chrome/Edge, botón «Instalar app» de la portada o el icono de instalar de la barra de direcciones;
en iPhone/iPad, Safari → Compartir → Añadir a pantalla de inicio.

## Publicidad (Google AdSense) y contenido

Todo lo editable está en `site.config.json`: nombre, dominio (`siteUrl`), correo, datos del titular para el aviso legal
y los ids de AdSense (`adsense.client` = `ca-pub-…` y un id por bloque). Sin `client`, no se carga nada de Google.

- Guías: `content/guias.mjs`. Páginas legales: `content/legales.mjs` (plantilla: revisa los datos antes de publicar).
- `npm run build` genera además `/guias/…`, las páginas legales, `sitemap.xml`, `robots.txt` y `ads.txt`.
- Anuncios: dos bloques en la portada y dos por guía. No hay anuncios dentro del editor para evitar clics accidentales.
- Consentimiento de cookies (UE): actívalo en AdSense → Privacidad y mensajes → Mensaje para reglamentos europeos.
  El enlace «Preferencias de privacidad» del pie ya abre ese aviso.

## Uso

```bash
npm install
npm run dev        # desarrollo
npm run build      # genera dist/ (estático, se puede subir a cualquier hosting)
npm test           # pruebas unitarias
npm run build && npm run e2e   # recorrido completo con Playwright (OUT_DIR=carpeta de salida)
node tests/pwa.mjs archivo.pdf  # instalable y sin conexión
node tests/pages.mjs            # páginas estáticas y enlaces
```

## Estructura

- `src/components/Home.tsx` portada y catálogo de herramientas
- `src/components/Editor.tsx` estado del editor, atajos, operaciones de página
- `src/components/PageView.tsx` página + capa de anotaciones interactiva
- `src/components/Toolbar.tsx` barra de herramientas y barra de propiedades
- `src/components/SignatureModal.tsx`, `ExportModal.tsx`
- `src/lib/export.ts` generación del PDF con pdf-lib (las anotaciones se dibujan en el contenido real)
- `src/lib/docs.ts` carga con pdf.js; `src/lib/matrix.ts` conversión pantalla ↔ PDF (soporta /Rotate)

Stack: React 18 + TypeScript + Vite, pdf.js (render), pdf-lib (escritura), fflate (ZIP).
