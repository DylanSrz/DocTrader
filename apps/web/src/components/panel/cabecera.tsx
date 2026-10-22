import { Suspense } from 'react';
import { salir } from '@/app/acciones-cuenta';
import { BarraFlotante } from '@/components/barra-flotante';
import { Marca } from '@/components/marca';
import { MenuMovil } from '@/components/menu-movil';
import { obtenerSesion } from '@/lib/sesion';
import { ListaPestanas, type Pestana, Pestanas } from './pestanas';

async function Usuario() {
  const sesion = await obtenerSesion();
  return (
    <div className="flex items-center gap-3 max-lg:hidden">
      {/* Entre 1024 y 1279 px no cabe con las siete pestañas del admin: queda solo "Salir". */}
      <span className="max-w-[16ch] truncate text-sm text-niebla max-xl:hidden">
        {sesion?.usuario.nombre}
      </span>
      <form action={salir}>
        <button type="submit" className="boton-barra">
          Salir
        </button>
      </form>
    </div>
  );
}

/** En el menú de celular y tablet: quién ingresó y "Salir", debajo de las pestañas. */
async function UsuarioEnMenu() {
  const sesion = await obtenerSesion();
  return (
    <div className="grid justify-items-start gap-1 border-t border-white/10 pt-6">
      <span className="text-sm text-niebla">{sesion?.usuario.nombre}</span>
      <form action={salir}>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center text-[15px] text-blanco underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
        >
          Salir
        </button>
      </form>
    </div>
  );
}

/** Las pestañas con lo pendiente de soporte, que viene con la sesión (una sola consulta por petición). */
async function PestanasConAvisos({
  pestanas,
  vertical = false,
}: {
  pestanas: Pestana[];
  vertical?: boolean;
}) {
  const sesion = await obtenerSesion();
  const soporte = pestanas.find((p) => p.aviso);
  return (
    <Pestanas
      pestanas={pestanas}
      vertical={vertical}
      avisos={soporte && sesion ? { [soporte.href]: sesion.soporte } : undefined}
    />
  );
}

/**
 * Barra de los paneles: la píldora de cristal más baja y a todo el ancho, con el logo, las pestañas (la activa sobre
 * la cápsula) y el nombre con "Salir". Celular y tablet: logo y menú de tres líneas.
 */
export function Cabecera({ pestanas }: { pestanas: Pestana[] }) {
  return (
    <BarraFlotante
      variante="panel"
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 pr-2 pl-5"
    >
      <Marca />
      {/* Escritorio: pestañas en la barra. Celular y tablet (menos de 1024 px): menú de tres líneas. */}
      <nav
        aria-label="Panel"
        className="max-w-full min-w-0 justify-self-center overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] max-lg:hidden [&::-webkit-scrollbar]:hidden"
      >
        <Suspense fallback={<ListaPestanas pestanas={pestanas} />}>
          <PestanasConAvisos pestanas={pestanas} />
        </Suspense>
      </nav>
      <Suspense fallback={<span className="min-h-11" />}>
        <Usuario />
      </Suspense>
      <MenuMovil etiqueta="Menú del panel" cabecera={<Marca />} className="col-start-3 lg:hidden">
        <nav aria-label="Panel">
          <Suspense fallback={<ListaPestanas pestanas={pestanas} vertical />}>
            <PestanasConAvisos pestanas={pestanas} vertical />
          </Suspense>
        </nav>
        <Suspense fallback={null}>
          <UsuarioEnMenu />
        </Suspense>
      </MenuMovil>
    </BarraFlotante>
  );
}
