export type Tool =
  | 'select'
  | 'text'
  | 'draw'
  | 'highlight'
  | 'whiteout'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'note'
  | 'check'
  | 'cross'
  | 'dot'
  | 'date'
  | 'stamp';

export type FontFamily =
  | 'helvetica'
  | 'times'
  | 'courier'
  | 'calibri'
  | 'cambria'
  | 'georgia'
  | 'garamond'
  | 'roboto'
  | 'opensans'
  | 'lato'
  | 'montserrat'
  | 'poppins'
  | 'verdana';

export interface TextAnn {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  font: FontFamily;
  bold: boolean;
  italic: boolean;
  color: string;
  /** Si sustituye a un texto del PDF: id del parche que tapa el original y clave de ese texto. */
  coverId?: string;
  sourceKey?: string;
  /**
   * Parche parcial: cuántos caracteres del texto original se conservan al principio y al final.
   * Solo se redibuja lo que cambió; el resto de la línea sigue siendo el texto original del PDF.
   */
  keep?: [number, number];
  /**
   * Estiramiento horizontal para que la letra parecida ocupe lo mismo que la original del PDF
   * (p. ej. un DNI o un importe escrito con una letra más ancha). 1 o sin definir: sin estirar.
   */
  scaleX?: number;
}

export interface InkAnn {
  id: string;
  type: 'ink';
  points: [number, number][];
  color: string;
  width: number;
}

export interface BoxAnn {
  id: string;
  type: 'rect' | 'ellipse' | 'highlight' | 'whiteout';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  width: number;
  /** Clave del texto original que tapa (solo parches de edición de texto). */
  sourceKey?: string;
  /** Texto completo de la línea tras la edición, para poder volver a editarla entera. */
  lineText?: string;
}

export interface LineAnn {
  id: string;
  type: 'line' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export interface ImageAnn {
  id: string;
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  src: string; // data URL (PNG o JPEG)
  signature: boolean;
}

export interface NoteAnn {
  id: string;
  type: 'note';
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface MarkAnn {
  id: string;
  type: 'mark';
  kind: 'check' | 'cross' | 'dot';
  x: number;
  y: number;
  size: number;
  color: string;
}

export type Annotation = TextAnn | InkAnn | BoxAnn | LineAnn | ImageAnn | NoteAnn | MarkAnn;

/**
 * Una página del documento en edición. Las coordenadas de las anotaciones están
 * en puntos PDF dentro del espacio "visible al cargar" (rotación original de la
 * página aplicada, origen arriba a la izquierda). La rotación que añade el usuario
 * gira la página entera, anotaciones incluidas.
 */
export interface Page {
  id: string;
  docId: string;
  index: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  annotations: Annotation[];
}

export interface ToolStyle {
  color: string;
  width: number;
  fontSize: number;
  font: FontFamily;
  bold: boolean;
  italic: boolean;
}

export type ExportFormat = 'pdf' | 'pdf-compressed' | 'jpg' | 'png';

export interface Intent {
  tool?: Tool;
  exportFormat?: ExportFormat;
  openSignature?: boolean;
}
