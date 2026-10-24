/** Matriz afín [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = [number, number, number, number, number, number];

/** Devuelve p ∘ q (se aplica primero q). */
export function compose(p: Matrix, q: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = p;
  const [a2, b2, c2, d2, e2, f2] = q;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function invert(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c;
  if (!det) throw new Error('Matriz no invertible');
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * A partir de la transformación de pdf.js (PDF → pantalla con y hacia abajo, escala 1)
 * calcula la matriz que lleva un espacio "pantalla con y hacia arriba" de alto h
 * al espacio de usuario del PDF. Dibujar con pdf-lib dentro de ese espacio
 * coloca cada elemento donde el usuario lo ve.
 */
export function displayUpToPdf(viewportTransform: Matrix, displayHeight: number): Matrix {
  const flip: Matrix = [1, 0, 0, -1, 0, displayHeight];
  return compose(invert(viewportTransform), flip);
}
