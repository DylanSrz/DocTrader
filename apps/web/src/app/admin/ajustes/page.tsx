import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import { Enlace, Etiqueta } from '@/components/ui';
import type { Ajustes } from '@/lib/admin';
import { llamarApi } from '@/lib/api';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import { AprobacionAutomatica } from '../pagos/acciones-pago';
import { Direcciones, Enlaces, Myfxbook, Operacion, Precios, Soporte } from './formularios';

export const metadata: Metadata = { title: 'Ajustes' };

function Grupo({
  id,
  titulo,
  nota,
  children,
}: {
  id: string;
  titulo: string;
  nota?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`t-${id}`}
      className="grid scroll-mt-8 grid-cols-[minmax(0,4fr)_minmax(0,7fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-6 max-md:grid-cols-1"
    >
      <div className="grid gap-2.5">
        <h2 id={`t-${id}`} className="text-medio">
          {titulo}
        </h2>
        {nota ? <p className="max-w-[26em] text-[15px] text-niebla">{nota}</p> : null}
      </div>
      <div className="grid gap-6">{children}</div>
    </section>
  );
}

async function Contenido() {
  await requerirSesion('ADMIN');
  const respuesta = await llamarApi<Ajustes>('/admin/ajustes', { token: await tokenDeSesion() });
  if (!respuesta.ok) {
    return <p className="text-error">No pudimos cargar los ajustes: {respuesta.error.mensaje}</p>;
  }
  const ajustes = respuesta.datos;
  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Ajustes</Etiqueta>
        <h1 className="text-grande">Ajustes</h1>
        <p className="max-w-[36em] text-blanco">
          Los cambios de precio y de días aplican a las órdenes nuevas; las licencias ya pagadas no
          cambian. Precios, plazos, direcciones y enlaces piden el código de tu app.
        </p>
      </div>

      <div className="mt-[clamp(56px,7vw,96px)] grid gap-[clamp(72px,9vw,120px)]">
        <Grupo
          id="precios"
          titulo="Precios"
          nota="En dólares. Cada orden guarda el precio con el que se creó."
        >
          <Precios ajustes={ajustes} />
        </Grupo>
        <Grupo
          id="licencias"
          titulo="Licencias y pagos"
          nota="Gracia, vigencia de la orden y confirmaciones mínimas antes de dar un pago por bueno."
        >
          <Operacion ajustes={ajustes} />
          <AprobacionAutomatica activa={ajustes.aprobacionAutomatica} />
        </Grupo>
        <Grupo
          id="direcciones"
          titulo="Direcciones de depósito"
          nota="Las órdenes nuevas usan la dirección activa más reciente de cada red. Cada orden guarda la suya."
        >
          <Direcciones ajustes={ajustes} />
        </Grupo>
        <Grupo
          id="soporte"
          titulo="Soporte"
          nota="Los tickets resueltos se cierran solos si el cliente no vuelve a escribir."
        >
          <Soporte ajustes={ajustes} />
          <Enlace href="/admin/respuestas" className="justify-self-start">
            Editar respuestas guardadas ({ajustes.respuestasGuardadas})
          </Enlace>
        </Grupo>
        <Grupo id="enlaces" titulo="Enlaces de la página">
          <Enlaces ajustes={ajustes} />
        </Grupo>
        <Grupo id="myfxbook" titulo="Myfxbook" nota="Las cifras que muestra la página pública.">
          <Myfxbook ajustes={ajustes} />
        </Grupo>
        <Grupo id="contenido" titulo="Textos de la página">
          <div className="grid justify-items-start gap-1">
            <Enlace href="/admin/preguntas">
              Editar preguntas frecuentes ({ajustes.preguntas})
            </Enlace>
            <Enlace href="/admin/legal">Textos legales</Enlace>
          </div>
        </Grupo>
      </div>
    </>
  );
}

export default function AjustesAdmin() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando los ajustes…</p>}>
      <Contenido />
    </Suspense>
  );
}
