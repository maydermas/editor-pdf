// Iconos propios dibujados a 24×24 con trazo.
const PATHS: Record<string, string> = {
  select: 'M5 3l13 8-6 1.5L9 19z',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  draw: 'M4 20c3-1 4-4 7-7l6-6a2 2 0 013 3l-6 6c-3 3-6 4-7 7zM14 7l3 3',
  highlight: 'M9 14l-4 4v2h6l2-2M8 13l7-9 5 5-9 7zM3 21h18',
  whiteout: 'M7 21h12M5 14l7-9 7 6-6 8H8zM9 19l-3-4',
  rect: 'M4 6h16v12H4z',
  ellipse: 'M12 6c4.5 0 8 2.7 8 6s-3.5 6-8 6-8-2.7-8-6 3.5-6 8-6z',
  line: 'M5 19L19 5',
  arrow: 'M5 19L19 5M10 5h9v9',
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5M8 9h8M8 12h5',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5a1.5 1.5 0 100-.01',
  signature: 'M3 17c3 0 4-9 6-9s0 9 2 9 2-4 4-4 1 3 3 3 2-1 3-1M3 21h18',
  check: 'M5 12l5 5L20 7',
  cross: 'M6 6l12 12M18 6L6 18',
  dot: 'M12 9a3 3 0 110 6 3 3 0 010-6z',
  date: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  shapes: 'M3 13h8v8H3zM17 3a4 4 0 110 8 4 4 0 010-8zM13 21l4-7 4 7z',
  marks: 'M4 12l4 4 8-9M14 14l6 6M20 14l-6 6',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3',
  zoomIn: 'M11 4a7 7 0 110 14 7 7 0 010-14zM21 21l-5-5M11 8v6M8 11h6',
  zoomOut: 'M11 4a7 7 0 110 14 7 7 0 010-14zM21 21l-5-5M8 11h6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  rotateL: 'M4 4v5h5M4.5 9A8 8 0 1112 20',
  rotateR: 'M20 4v5h-5M19.5 9A8 8 0 1012 20',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  close: 'M6 6l12 12M18 6L6 18',
  pages: 'M7 3h10v14H7zM4 7v14h10',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5',
  bold: 'M7 4h6a4 4 0 010 8H7zM7 12h7a4 4 0 010 8H7z',
  italic: 'M10 4h8M6 20h8M14 4l-4 16',
  chevron: 'M6 9l6 6 6-6',
  merge: 'M6 4v6a6 6 0 006 6v4M18 4v6a6 6 0 01-6 6',
  split: 'M12 4v6M12 10l-6 6v4M12 10l6 6v4',
  compress: 'M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 018 0v4',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  devices: 'M3 5h14v10H3zM7 19h6M19 9h3v11h-5v-3',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  form: 'M5 3h14v18H5zM8 8h8M8 12h8M8 16h4',
  convert: 'M4 7h13l-3-3M20 17H7l3 3',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

export function Icon({ name, size = 20, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? PATHS.file} />
    </svg>
  );
}
