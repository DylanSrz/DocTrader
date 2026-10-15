'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Pestañas del panel en mayúsculas; la activa en blanco, con un triángulo naranja debajo. */
export function Pestanas({ pestanas }: { pestanas: Pestana[] }) {
  const ruta = usePathname();
  // La pestaña activa es la de la ruta más larga que coincide (/admin/legal/terminos → /admin/legal).
  const activa = pestanas
    .filter((p) => ruta === p.href || ruta.startsWith(`${p.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return <ListaPestanas pestanas={pestanas} activa={activa} />;
}

type Pestana = { href: string; texto: string };

/** Las pestañas sin saber la ruta (mientras se prerenderiza la página): ninguna marcada. */
export function ListaPestanas({ pestanas, activa }: { pestanas: Pestana[]; activa?: string }) {
  return (
    <ul className="flex gap-[clamp(16px,3vw,40px)]">
      {pestanas.map((p) => (
        <li key={p.href}>
          <Link
            href={p.href}
            aria-current={p.href === activa ? 'page' : undefined}
            className="relative inline-flex min-h-11 items-center texto-menu whitespace-nowrap text-ceniza transition-colors duration-200 hover:text-blanco aria-[current=page]:text-blanco aria-[current=page]:after:absolute aria-[current=page]:after:bottom-0.5 aria-[current=page]:after:left-1/2 aria-[current=page]:after:size-0 aria-[current=page]:after:-translate-x-1/2 aria-[current=page]:after:border-x-4 aria-[current=page]:after:border-b-[7px] aria-[current=page]:after:border-x-transparent aria-[current=page]:after:border-b-llama"
          >
            {p.texto}
          </Link>
        </li>
      ))}
    </ul>
  );
}
