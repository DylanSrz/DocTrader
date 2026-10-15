import { LIMITES_TICKET } from '@doctrader/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Enlace, Etiqueta } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import type { RespuestaGuardada } from '@/lib/soporte';
import { EditarRespuesta } from './editor';

export const metadata: Metadata = { title: 'Respuestas guardadas' };

async function Contenido() {
  await requerirSesion('ADMIN');
  const r = await llamarApi<RespuestaGuardada[]>('/admin/respuestas', {
    token: await tokenDeSesion(),
  });
  if (!r.ok) {
    return <p className="text-error">No pudimos cargar las respuestas: {r.error.mensaje}</p>;
  }
  const respuestas = r.datos;
  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Soporte</Etiqueta>
        <h1 className="text-grande">Respuestas guardadas</h1>
        <p className="max-w-[36em] text-blanco">
          Textos que se repiten al responder tickets. Al elegir una, se agrega al mensaje y puedes
          ajustarla antes de enviar.
        </p>
        <Enlace href="/admin/soporte" gris>
          Volver a soporte
        </Enlace>
      </div>

      <div className="mt-[clamp(56px,7vw,96px)] grid max-w-[760px] gap-[clamp(56px,7vw,80px)]">
        {respuestas.length < LIMITES_TICKET.respuestasGuardadas ? (
          <section aria-labelledby="t-nueva" className="grid gap-5">
            <h2 id="t-nueva" className="text-medio">
              Nueva respuesta
            </h2>
            <EditarRespuesta />
          </section>
        ) : null}
        {respuestas.length > 0 ? (
          <section aria-labelledby="t-guardadas" className="grid gap-5">
            <h2 id="t-guardadas" className="text-medio">
              {respuestas.length === 1 ? '1 guardada' : `${respuestas.length} guardadas`}
            </h2>
            <ol className="grid">
              {respuestas.map((r) => (
                <li key={r.id} className="border-t border-white/8 py-8 first:border-t-0 first:pt-0">
                  <EditarRespuesta respuesta={r} />
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </>
  );
}

export default function RespuestasAdmin() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando las respuestas…</p>}>
      <Contenido />
    </Suspense>
  );
}
