'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cx } from './ui';

/** Lo que hay que desplazarse (en px) para que la barra se esconda o vuelva: evita parpadeos con el trackpad. */
const UMBRAL = 8;
/** Desde aquí la píldora se vuelve compacta: más opaca, más desenfoque, sombra más marcada y un poco más baja. */
const COMPACTA = 48;
/** Arriba de esto la barra siempre está a la vista. */
const ZONA_SUPERIOR = 96;

/**
 * Barra de navegación flotante: una píldora de cristal oscuro (fondo translúcido con desenfoque y borde fino) fija
 * arriba. La usan la landing y los dos paneles; estilos en `.barra` y `.barra-pildora` (globals.css).
 * - Al pasar de `COMPACTA` px se vuelve más opaca y baja unos píxeles de alto. La caja que la contiene mide siempre lo
 *   mismo, así que el contenido de la página no se mueve.
 * - Se esconde mientras se baja y vuelve con un poco de desplazamiento hacia arriba (`ocultable`).
 * - No se esconde si tiene el foco del teclado (quien navega con Tab siempre la ve).
 * - Con "reducir movimiento", cambia sin animación.
 * - El contenido (`children`) es la fila de la barra; `className` le da su distribución.
 */
export function BarraFlotante({
  children,
  className,
  variante = 'publica',
  ocultable = true,
}: {
  children: ReactNode;
  className?: string;
  /** `publica`: píldora más alta y centrada (landing). `panel`: más baja y a todo el ancho (paneles). */
  variante?: 'publica' | 'panel';
  ocultable?: boolean;
}) {
  const [oculta, setOculta] = useState(false);
  const [compacta, setCompacta] = useState(false);
  const barra = useRef<HTMLElement>(null);

  useEffect(() => {
    let referencia = window.scrollY;
    let cuadro = 0;
    const alDesplazar = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const y = Math.max(window.scrollY, 0);
        setCompacta(y > COMPACTA);
        if (!ocultable) return;
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
  }, [ocultable]);

  return (
    <header
      ref={barra}
      onFocusCapture={() => setOculta(false)}
      data-oculta={oculta || undefined}
      data-compacta={compacta || undefined}
      data-variante={variante}
      className="barra"
    >
      <div className="contenedor">
        <div className="barra-caja">
          <div className={cx('barra-pildora', className)}>{children}</div>
        </div>
      </div>
    </header>
  );
}
