import { useCallback, useRef, useState } from 'react';

const LIMIT = 100;

/**
 * Estado con deshacer/rehacer. `set(next)` guarda un paso; durante un gesto
 * (arrastrar, dibujar) se llama a `checkpoint()` al empezar y a `replace(next)`
 * en cada movimiento, de modo que el gesto entero es un solo paso.
 */
export function useHistory<T>(initial: T) {
  const [present, setPresent] = useState(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const presentRef = useRef(present);
  presentRef.current = present;
  const [, force] = useState(0);

  const checkpoint = useCallback(() => {
    past.current.push(presentRef.current);
    if (past.current.length > LIMIT) past.current.shift();
    future.current = [];
    force((n) => n + 1);
  }, []);

  const replace = useCallback((next: T | ((prev: T) => T)) => {
    setPresent((prev) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      presentRef.current = value;
      return value;
    });
  }, []);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      checkpoint();
      replace(next);
    },
    [checkpoint, replace],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(presentRef.current);
    presentRef.current = prev;
    setPresent(prev);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(presentRef.current);
    presentRef.current = next;
    setPresent(next);
  }, []);

  const reset = useCallback((value: T) => {
    past.current = [];
    future.current = [];
    presentRef.current = value;
    setPresent(value);
  }, []);

  return {
    present,
    get: () => presentRef.current,
    set,
    replace,
    checkpoint,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
