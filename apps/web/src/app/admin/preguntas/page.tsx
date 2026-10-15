import type { PreguntaFrecuente } from '@doctrader/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Etiqueta } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import { EditorPreguntas } from './editor';

export const metadata: Metadata = { title: 'Preguntas frecuentes' };

async function Contenido() {
  await requerirSesion('ADMIN');
  const respuesta = await llamarApi<PreguntaFrecuente[]>('/admin/preguntas', {
    token: await tokenDeSesion(),
  });
  return <EditorPreguntas iniciales={respuesta.ok ? respuesta.datos : []} />;
}

export default function Preguntas() {
  return (
    <div className="grid gap-12">
      <div className="grid gap-6">
        <Etiqueta>Página pública</Etiqueta>
        <h1 className="max-w-[16ch] text-grande">Preguntas frecuentes.</h1>
        <p className="max-w-[36em] text-niebla">
          Lo que guardes aquí se ve en la landing en menos de un minuto. En las respuestas puedes
          usar <span className="text-blanco">**negrita**</span> y enlaces como{' '}
          <span className="text-blanco">[Telegram](https://t.me/…)</span>.
        </p>
      </div>
      <Suspense fallback={<p className="text-ceniza">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </div>
  );
}
