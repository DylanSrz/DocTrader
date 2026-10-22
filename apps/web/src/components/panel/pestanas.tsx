'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, type Ref, useEffect, useRef } from 'react';
import { Capsula, useCapsula } from '@/components/capsula';

/**
 * Pestañas del panel en mayúsculas. La activa va en blanco sobre la cápsula, que se desliza de una pestaña a otra al
 * navegar (el layout no se vuelve a montar, así que la cápsula sigue viva entre rutas).
 */
export function Pestanas({
  pestanas,
  avisos,
  vertical = false,
}: {
  pestanas: Pestana[];
  avisos?: Record<string, number>;
  /** En el menú de celular y tablet: una debajo de otra, grandes. */
  vertical?: boolean;
}) {
  const ruta = usePathname();
  // La pestaña activa es la de la ruta más larga que coincide (/admin/legal/terminos → /admin/legal).
  // `tambien`: otras rutas que viven bajo esa pestaña (las preguntas y los textos legales, bajo Ajustes).
  const activa = pestanas
    .flatMap((p) => [p.href, ...(p.tambien ?? [])].map((ruta) => ({ ruta, href: p.href })))
    .filter((p) => ruta === p.ruta || ruta.startsWith(`${p.ruta}/`))
    .sort((a, b) => b.ruta.length - a.ruta.length)[0]?.href;
  const lista = useRef<HTMLUListElement>(null);
  const { posicion, animar } = useCapsula(lista, vertical ? undefined : activa);
  // En el teléfono las pestañas se desplazan de lado: la activa queda a la vista.
  useEffect(() => {
    const actual = lista.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const barra = lista.current?.parentElement;
    if (!actual || !barra || barra.scrollWidth <= barra.clientWidth) return;
    barra.scrollTo({ left: actual.offsetLeft - (barra.clientWidth - actual.offsetWidth) / 2 });
  }, [activa]);
  return (
    <ListaPestanas
      ref={lista}
      pestanas={pestanas}
      activa={activa}
      avisos={avisos}
      vertical={vertical}
      capsula={vertical ? null : <Capsula posicion={posicion} animar={animar} />}
    />
  );
}

export type Pestana = {
  href: string;
  texto: string;
  tambien?: string[];
  /**
   * Cómo se anuncia lo pendiente: un punto naranja (cliente) o el número (admin), con el texto para lectores de
   * pantalla (`#` es el número). Son datos y no funciones porque vienen del servidor.
   */
  aviso?: { tipo: 'punto' | 'numero'; uno: string; varios: string };
};

/** Las pestañas sin saber la ruta (mientras se prerenderiza la página): ninguna marcada. */
export function ListaPestanas({
  pestanas,
  activa,
  avisos,
  ref,
  vertical = false,
  capsula = null,
}: {
  pestanas: Pestana[];
  activa?: string;
  avisos?: Record<string, number>;
  ref?: Ref<HTMLUListElement>;
  vertical?: boolean;
  capsula?: ReactNode;
}) {
  if (vertical) {
    return (
      <ul ref={ref} className="grid gap-1">
        {pestanas.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              aria-current={p.href === activa ? 'page' : undefined}
              className="enlace-menu"
            >
              {p.texto}
              <Aviso pestana={p} n={avisos?.[p.href] ?? 0} />
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul ref={ref} className="relative flex items-center">
      {capsula}
      {pestanas.map((p) => (
        <li key={p.href}>
          <Link
            href={p.href}
            data-capsula={p.href}
            aria-current={p.href === activa ? 'page' : undefined}
            className="enlace-barra"
          >
            {p.texto}
            <Aviso pestana={p} n={avisos?.[p.href] ?? 0} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Lo pendiente de una pestaña: forma y texto para lectores de pantalla, nunca solo color. */
function Aviso({ pestana, n }: { pestana: Pestana; n: number }) {
  if (!pestana.aviso || n <= 0) return null;
  return (
    <>
      {pestana.aviso.tipo === 'punto' ? (
        <span aria-hidden="true" className="ml-1.5 inline-block size-[7px] rounded-full bg-llama" />
      ) : (
        <span
          aria-hidden="true"
          className="cifra ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-llama px-1.5 text-[11px] leading-5 font-semibold text-vacio"
        >
          {n}
        </span>
      )}
      <span className="sr-only">
        , {n === 1 ? pestana.aviso.uno : pestana.aviso.varios.replace('#', String(n))}
      </span>
    </>
  );
}
