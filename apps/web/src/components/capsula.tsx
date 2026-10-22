'use client';

import { type RefObject, useEffect, useState } from 'react';

type Posicion = { x: number; ancho: number };

/**
 * Dónde está el enlace activo dentro de una lista horizontal (`position: relative`), para mover la cápsula debajo de
 * él. El enlace se marca con `data-capsula="<clave>"`.
 * - Mide solo cuando cambia el activo o cambia el tamaño de la lista (ResizeObserver: ventana, fuentes que cargan,
 *   un aviso que aparece), nunca en cada scroll.
 * - La primera posición se pone sin animación; desde ahí la cápsula se desliza.
 */
export function useCapsula(lista: RefObject<HTMLElement | null>, activa: string | undefined) {
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const [animar, setAnimar] = useState(false);

  useEffect(() => {
    const elemento = lista.current;
    if (!elemento) return;
    let cuadro = 0;
    const medir = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const enlace = activa
          ? elemento.querySelector<HTMLElement>(`[data-capsula="${CSS.escape(activa)}"]`)
          : null;
        setPosicion(enlace ? { x: enlace.offsetLeft, ancho: enlace.offsetWidth } : null);
      });
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => {
      observador.disconnect();
      cancelAnimationFrame(cuadro);
    };
  }, [lista, activa]);

  // Con la primera posición puesta, las siguientes se animan.
  useEffect(() => {
    if (!posicion || animar) return;
    const cuadro = requestAnimationFrame(() => setAnimar(true));
    return () => cancelAnimationFrame(cuadro);
  }, [posicion, animar]);

  return { posicion, animar };
}

/** La cápsula: un fondo claro y suave detrás del enlace activo. Va dentro de la lista, antes de los enlaces. */
export function Capsula({ posicion, animar }: { posicion: Posicion | null; animar: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="capsula"
      data-animar={animar || undefined}
      data-visible={posicion ? true : undefined}
      style={
        posicion
          ? { transform: `translateX(${posicion.x}px)`, width: `${posicion.ancho}px` }
          : undefined
      }
    />
  );
}
