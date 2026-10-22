'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cx } from './ui';

/** Lo que hay que desplazarse (en px) para que la barra se esconda o vuelva: evita parpadeos con el trackpad. */
const UMBRAL = 8;
/** Arriba de esto la barra siempre está a la vista y sin fondo, como parte de la página. */
const ZONA_SUPERIOR = 96;

/**
 * Barra de navegación fija arriba. En lo alto de la página se ve como siempre; al bajar se vuelve una píldora
 * flotante (fondo negro translúcido con desenfoque) y se esconde mientras se sigue bajando. Con un poco de
 * desplazamiento hacia arriba vuelve a aparecer.
 * - No se esconde si tiene el foco del teclado (quien navega con Tab siempre la ve).
 * - Con "reducir movimiento", aparece y desaparece sin deslizarse.
 * - El contenido (`children`) es la fila de la barra; `className` le da su distribución.
 */
export function BarraFlotante({
  children,
  className,
  margenSuperior = 'pt-[calc(env(safe-area-inset-top,0px)+14px)]',
}: {
  children: ReactNode;
  className?: string;
  /** Espacio sobre la barra en lo alto de la página (el de cada diseño). */
  margenSuperior?: string;
}) {
  const [oculta, setOculta] = useState(false);
  const [flotando, setFlotando] = useState(false);
  const barra = useRef<HTMLElement>(null);

  useEffect(() => {
    let referencia = window.scrollY;
    let cuadro = 0;
    const alDesplazar = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const y = Math.max(window.scrollY, 0);
        setFlotando(y > UMBRAL);
        if (y < ZONA_SUPERIOR) {
          setOculta(false);
          referencia = y;
          return;
        }
        const delta = y - referencia;
        if (Math.abs(delta) < UMBRAL) return;
        const conFoco = barra.current?.contains(document.activeElement) ?? false;
        setOculta(delta > 0 && !conFoco);
        referencia = y;
      });
    };
    alDesplazar();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      cancelAnimationFrame(cuadro);
    };
  }, []);

  return (
    <header
      ref={barra}
      onFocusCapture={() => setOculta(false)}
      data-oculta={oculta || undefined}
      className={cx(
        'sticky top-0 z-40 transition-transform duration-300 ease-salida will-change-transform motion-reduce:transition-none',
        oculta && '-translate-y-[calc(100%+8px)]',
        // El margen no cambia al flotar: si cambiara, el navegador corregiría el scroll unos píxeles hacia arriba y
        // la barra reaparecería justo al empezar a bajar.
        margenSuperior,
      )}
    >
      <div className="contenedor">
        <div
          className={cx(
            // La píldora sobresale 16 px a cada lado para que el contenido quede alineado con la página.
            '-mx-4 rounded-pildora px-4 transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-salida motion-reduce:transition-none',
            flotando
              ? 'bg-vacio/90 shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_12px_32px_rgb(0_0_0/0.45)] backdrop-blur-xl'
              : 'bg-transparent',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </header>
  );
}
