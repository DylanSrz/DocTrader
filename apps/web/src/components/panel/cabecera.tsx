import { Suspense } from 'react';
import { salir } from '@/app/acciones-cuenta';
import { Marca } from '@/components/marca';
import { obtenerSesion } from '@/lib/sesion';
import { ListaPestanas, Pestanas } from './pestanas';

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
export function Cabecera({ pestanas }: { pestanas: { href: string; texto: string }[] }) {
  return (
    <header className="pt-[calc(env(safe-area-inset-top,0px)+14px)]">
      <div className="contenedor grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-x-6 max-md:grid-cols-[1fr_auto]">
        <Marca />
        <nav
          aria-label="Panel"
          className="justify-self-center overflow-x-auto max-md:col-span-2 max-md:row-start-2 max-md:justify-self-start"
        >
          <Suspense fallback={<ListaPestanas pestanas={pestanas} />}>
            <Pestanas pestanas={pestanas} />
          </Suspense>
        </nav>
        <Suspense fallback={<span className="min-h-11" />}>
          <Usuario />
        </Suspense>
      </div>
    </header>
  );
}
