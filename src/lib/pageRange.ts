/**
 * Interpreta rangos como "1-3,5 8-9" (numeración desde 1).
 * Devuelve grupos (uno por rango) con índices desde 0, o un mensaje de error.
 */
export function parsePageRanges(input: string, pageCount: number): { groups: number[][] } | { error: string } {
  const text = input.trim();
  if (!text) return { groups: [Array.from({ length: pageCount }, (_, i) => i)] };
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const groups: number[][] = [];
  for (const token of tokens) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!m) return { error: `«${token}» no es un rango válido. Usa por ejemplo 1-3,5.` };
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < 1 || a > pageCount || b > pageCount) {
      return { error: `El documento tiene ${pageCount} página${pageCount === 1 ? '' : 's'}; «${token}» está fuera de rango.` };
    }
    const step = a <= b ? 1 : -1;
    const group: number[] = [];
    for (let i = a; i !== b + step; i += step) group.push(i - 1);
    groups.push(group);
  }
  return { groups };
}
