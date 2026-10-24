import type { Annotation } from '../types';
import { BASELINE, FONT_CSS, LINE_HEIGHT, NOTE_SIZE, arrowHead, inkPath, markPath } from '../lib/annotations';

interface Props {
  a: Annotation;
  hidden?: boolean;
  onPointerDown?: (e: React.PointerEvent, a: Annotation) => void;
  onDoubleClick?: (a: Annotation) => void;
}

/** Dibuja una anotación en SVG con las mismas medidas que usa la exportación. */
export function AnnotationShape({ a, hidden, onPointerDown, onDoubleClick }: Props) {
  const common = {
    'data-ann': a.id,
    onPointerDown: onPointerDown ? (e: React.PointerEvent) => onPointerDown(e, a) : undefined,
    onDoubleClick: onDoubleClick ? () => onDoubleClick(a) : undefined,
    style: hidden ? { visibility: 'hidden' as const } : undefined,
  };
  switch (a.type) {
    case 'text':
      return (
        <text
          {...common}
          fill={a.color}
          fontFamily={FONT_CSS[a.font]}
          fontSize={a.fontSize}
          fontWeight={a.bold ? 700 : 400}
          fontStyle={a.italic ? 'italic' : 'normal'}
          xmlSpace="preserve"
          className="ann-text"
        >
          {a.text.split('\n').map((line, i) => (
            <tspan key={i} x={a.x} y={a.y + a.fontSize * (BASELINE + i * LINE_HEIGHT)}>
              {line || ' '}
            </tspan>
          ))}
        </text>
      );
    case 'ink':
      return <path {...common} d={inkPath(a.points)} stroke={a.color} strokeWidth={a.width} fill="none" strokeLinecap="round" strokeLinejoin="round" className="ann-stroke" />;
    case 'highlight':
      return <rect {...common} x={a.x} y={a.y} width={a.w} height={a.h} fill={a.color} opacity={0.4} style={{ ...common.style, mixBlendMode: 'multiply' }} />;
    case 'whiteout':
      return <rect {...common} x={a.x} y={a.y} width={a.w} height={a.h} fill="#fff" className="ann-whiteout" />;
    case 'rect':
      return <rect {...common} x={a.x} y={a.y} width={a.w} height={a.h} stroke={a.color} strokeWidth={a.width} fill="transparent" className="ann-stroke" />;
    case 'ellipse':
      return <ellipse {...common} cx={a.x + a.w / 2} cy={a.y + a.h / 2} rx={a.w / 2} ry={a.h / 2} stroke={a.color} strokeWidth={a.width} fill="transparent" className="ann-stroke" />;
    case 'line':
    case 'arrow': {
      const d = `M${a.x1} ${a.y1} L${a.x2} ${a.y2}` + (a.type === 'arrow' ? ' ' + arrowHead(a.x1, a.y1, a.x2, a.y2, a.width) : '');
      return (
        <g {...common}>
          <path d={d} stroke="transparent" strokeWidth={Math.max(10, a.width + 8)} fill="none" />
          <path d={d} stroke={a.color} strokeWidth={a.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    }
    case 'mark':
      if (a.kind === 'dot') return <circle {...common} cx={a.x + a.size / 2} cy={a.y + a.size / 2} r={a.size * 0.3} fill={a.color} />;
      return (
        <g {...common}>
          <rect x={a.x} y={a.y} width={a.size} height={a.size} fill="transparent" />
          <path d={markPath(a.kind, a.x, a.y, a.size)} stroke={a.color} strokeWidth={Math.max(1.5, a.size / 9)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case 'image':
      return <image {...common} href={a.src} x={a.x} y={a.y} width={a.w} height={a.h} preserveAspectRatio="none" />;
    case 'note':
      return (
        <g {...common} className="ann-note">
          <title>{a.text || 'Nota vacía'}</title>
          <path
            d={`M${a.x} ${a.y}h${NOTE_SIZE}v${NOTE_SIZE * 0.7}l-${NOTE_SIZE * 0.3} ${NOTE_SIZE * 0.3}h-${NOTE_SIZE * 0.7}z`}
            fill={a.color}
            stroke="rgba(0,0,0,.35)"
            strokeWidth={1}
          />
          <path d={`M${a.x + 5} ${a.y + 7}h12M${a.x + 5} ${a.y + 11}h12M${a.x + 5} ${a.y + 15}h7`} stroke="rgba(0,0,0,.45)" strokeWidth={1.2} />
        </g>
      );
  }
}

export function AnnotationLayer({ annotations, width, height }: { annotations: Annotation[]; width: number; height: number }) {
  return (
    <svg className="ann-svg" viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" aria-hidden="true">
      {annotations.map((a) => (
        <AnnotationShape key={a.id} a={a} />
      ))}
    </svg>
  );
}
