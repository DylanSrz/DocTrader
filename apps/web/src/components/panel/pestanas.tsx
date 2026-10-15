'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type Ref, useEffect, useRef } from 'react';

/** Pestañas del panel en mayúsculas; la activa en blanco, con un triángulo naranja debajo. */
export function Pestanas({
  pestanas,
  avisos,
}: {
  pestanas: Pestana[];
  avisos?: Record<string, number>;
}) {
  const ruta = usePathname();
  // La pestaña activa es la de la ruta más larga que coincide (/admin/legal/terminos → /admin/legal).
  // `tambien`: otras rutas que viven bajo esa pestaña (las preguntas y los textos legales, bajo Ajustes).
  const activa = pestanas
    .flatMap((p) => [p.href, ...(p.tambien ?? [])].map((ruta) => ({ ruta, href: p.href })))
    .filter((p) => ruta === p.ruta || ruta.startsWith(`${p.ruta}/`))
    .sort((a, b) => b.ruta.length - a.ruta.length)[0]?.href;
  const lista = useRef<HTMLUListElement>(null);
  // En el teléfono las pestañas se desplazan de lado: la activa queda a la vista.
  useEffect(() => {
    const actual = lista.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const barra = lista.current?.parentElement;
    if (!actual || !barra || barra.scrollWidth <= barra.clientWidth) return;
    barra.scrollTo({ left: actual.offsetLeft - (barra.clientWidth - actual.offsetWidth) / 2 });
  }, [activa]);
  return <ListaPestanas ref={lista} pestanas={pestanas} activa={activa} avisos={avisos} />;
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
}: {
  pestanas: Pestana[];
  activa?: string;
  avisos?: Record<string, number>;
  ref?: Ref<HTMLUListElement>;
}) {
  return (
    <ul ref={ref} className="flex gap-[clamp(16px,3vw,40px)]">
      {pestanas.map((p) => (
        <li key={p.href}>
          <Link
            href={p.href}
            aria-current={p.href === activa ? 'page' : undefined}
            className="relative inline-flex min-h-11 items-center texto-menu whitespace-nowrap text-ceniza transition-colors duration-200 hover:text-blanco aria-[current=page]:text-blanco aria-[current=page]:after:absolute aria-[current=page]:after:bottom-0.5 aria-[current=page]:after:left-1/2 aria-[current=page]:after:size-0 aria-[current=page]:after:-translate-x-1/2 aria-[current=page]:after:border-x-4 aria-[current=page]:after:border-b-[7px] aria-[current=page]:after:border-x-transparent aria-[current=page]:after:border-b-llama"
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
