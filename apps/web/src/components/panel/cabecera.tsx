import { Suspense } from 'react';
import { salir } from '@/app/acciones-cuenta';
import { Marca } from '@/components/marca';
import { obtenerSesion } from '@/lib/sesion';
import { ListaPestanas, type Pestana, Pestanas } from './pestanas';

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

/** Las pestañas con lo pendiente de soporte, que viene con la sesión (una sola consulta por petición). */
async function PestanasConAvisos({ pestanas }: { pestanas: Pestana[] }) {
  const sesion = await obtenerSesion();
  const soporte = pestanas.find((p) => p.aviso);
  return (
    <Pestanas
      pestanas={pestanas}
      avisos={soporte && sesion ? { [soporte.href]: sesion.soporte } : undefined}
    />
  );
}

/**
 * Barra de los paneles: logo, pestañas en mayúsculas (la activa en blanco con un triángulo naranja debajo) y el
 * nombre con "Salir". Igual a la del prototipo del panel del cliente.
 */
export function Cabecera({ pestanas }: { pestanas: Pestana[] }) {
  return (
    <header className="pt-[calc(env(safe-area-inset-top,0px)+14px)]">
      <div className="contenedor grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-6 max-md:grid-cols-[minmax(0,1fr)_auto]">
        <Marca />
        <nav
          aria-label="Panel"
          className="max-w-full min-w-0 justify-self-center overflow-x-auto overscroll-x-contain [scrollbar-width:none] max-md:col-span-2 max-md:row-start-2 max-md:justify-self-start [&::-webkit-scrollbar]:hidden"
        >
          <Suspense fallback={<ListaPestanas pestanas={pestanas} />}>
            <PestanasConAvisos pestanas={pestanas} />
          </Suspense>
        </nav>
        <Suspense fallback={<span className="min-h-11" />}>
          <Usuario />
        </Suspense>
      </div>
    </header>
  );
}
