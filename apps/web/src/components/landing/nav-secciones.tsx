'use client';

import { useEffect, useRef, useState } from 'react';
import { Capsula, useCapsula } from '@/components/capsula';

/**
 * Enlaces a las secciones de la landing, con la cápsula detrás de la sección que se está leyendo. La sección activa
 * es la que cruza la franja del medio de la pantalla (IntersectionObserver: sin cálculos en cada scroll); entre
 * secciones sin enlace (el inicio, los resultados) no hay ninguna marcada.
 */
export function NavSecciones({ secciones }: { secciones: readonly (readonly [string, string])[] }) {
  const [activa, setActiva] = useState<string>();
  const lista = useRef<HTMLUListElement>(null);
  const { posicion, animar } = useCapsula(lista, activa);

  useEffect(() => {
    const visibles = new Set<string>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const href = `#${entrada.target.id}`;
          if (entrada.isIntersecting) visibles.add(href);
          else visibles.delete(href);
        }
        // Si dos tocan la franja a la vez, gana la que va primero en el menú.
        setActiva(secciones.map(([href]) => href).find((href) => visibles.has(href)));
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const [href] of secciones) {
      const seccion = document.getElementById(href.slice(1));
      if (seccion) observador.observe(seccion);
    }
    return () => observador.disconnect();
  }, [secciones]);

  return (
    <ul ref={lista} className="relative flex items-center">
      <Capsula posicion={posicion} animar={animar} />
      {secciones.map(([href, texto]) => (
        <li key={href}>
          <a
            href={href}
            data-capsula={href}
            aria-current={href === activa ? 'location' : undefined}
            className="enlace-barra"
          >
            {texto}
          </a>
        </li>
      ))}
    </ul>
  );
}
