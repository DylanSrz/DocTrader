'use client';

import { useEffect, useRef, useState } from 'react';

const DURACION = 1400;
/** Sale rápido y frena al llegar, como un contador que se asienta. */
const salida = (t: number) => 1 - (1 - t) ** 4;

/**
 * Número que cuenta desde 0 hasta su valor cuando entra en pantalla.
 * - El HTML del servidor trae el valor final: buscadores, lectores de pantalla y quien no tiene JavaScript lo ven
 *   completo. Solo se pone en 0 si la cifra todavía no está a la vista, así que nadie ve el salto.
 * - Una copia invisible del valor final reserva el ancho: el texto de alrededor no se mueve mientras cuenta.
 * - Con "reducir movimiento" no cuenta.
 */
export function CifraAnimada({
  valor,
  decimales = 0,
  prefijo = '',
  sufijo = '',
}: {
  valor: number;
  decimales?: number;
  prefijo?: string;
  sufijo?: string;
}) {
  const formato = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  const texto = (n: number) => `${prefijo}${formato.format(n)}${sufijo}`;
  const [mostrado, setMostrado] = useState(valor);
  const caja = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const elemento = caja.current;
    if (!elemento || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const { top, bottom } = elemento.getBoundingClientRect();
    if (top < innerHeight && bottom > 0) return; // ya a la vista: se queda como está
    setMostrado(0);
    let cuadro = 0;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return;
        observador.disconnect();
        const inicio = performance.now();
        const paso = (ahora: number) => {
          const t = Math.min((ahora - inicio) / DURACION, 1);
          setMostrado(t === 1 ? valor : valor * salida(t));
          if (t < 1) cuadro = requestAnimationFrame(paso);
        };
        cuadro = requestAnimationFrame(paso);
      },
      { threshold: 0.6 },
    );
    observador.observe(elemento);
    return () => {
      observador.disconnect();
      cancelAnimationFrame(cuadro);
    };
  }, [valor]);

  return (
    <span ref={caja} className="inline-grid">
      <span className="sr-only">{texto(valor)}</span>
      <span aria-hidden="true" className="invisible [grid-area:1/1]">
        {texto(valor)}
      </span>
      <span aria-hidden="true" className="[grid-area:1/1]">
        {texto(mostrado)}
      </span>
    </span>
  );
}
