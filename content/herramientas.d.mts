export interface Herramienta {
  slug: string;
  enlace: string;
  title: string;
  description: string;
  pasos: string[];
  body: string;
  faq: [string, string][];
}
export const herramientas: Herramienta[];
