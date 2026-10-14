import Link from 'next/link';
import { Suspense } from 'react';
import { salir } from '@/app/acciones-cuenta';
import { Marca } from '@/components/marca';
import { obtenerSesion } from '@/lib/sesion';

async function Usuario() {
  const sesion = await obtenerSesion();
  return (
    <div className="flex items-center gap-5">
      <span className="hidden text-sm text-niebla sm:inline">{sesion?.usuario.nombre}</span>
      <form action={salir}>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco hover:decoration-current"
        >
          Salir
        </button>
      </form>
    </div>
  );
}

/**
 * Barra de los paneles: logo, pestañas en mayúsculas (la activa en blanco con un triángulo naranja debajo) y el
 * nombre con "Salir". Igual a la del prototipo del panel del cliente.
 */
export function Cabecera({
  pestanas,
  actual,
}: {
  pestanas: { href: string; texto: string }[];
  actual: string;
}) {
  return (
    <header className="pt-[calc(env(safe-area-inset-top,0px)+14px)]">
      <div className="contenedor grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-6">
        <Marca />
        <nav aria-label="Panel" className="justify-self-center">
          <ul className="flex gap-[clamp(20px,3vw,40px)]">
            {pestanas.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  aria-current={p.href === actual ? 'page' : undefined}
                  className="relative inline-flex min-h-11 items-center texto-menu text-ceniza transition-colors duration-200 hover:text-blanco aria-[current=page]:text-blanco aria-[current=page]:after:absolute aria-[current=page]:after:bottom-0.5 aria-[current=page]:after:left-1/2 aria-[current=page]:after:size-0 aria-[current=page]:after:-translate-x-1/2 aria-[current=page]:after:border-x-4 aria-[current=page]:after:border-b-[7px] aria-[current=page]:after:border-x-transparent aria-[current=page]:after:border-b-llama"
                >
                  {p.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Suspense fallback={<span className="min-h-11" />}>
          <Usuario />
        </Suspense>
      </div>
    </header>
  );
}
