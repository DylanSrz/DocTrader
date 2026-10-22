import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VistaReferidor } from '@/components/referidos/vista-referidor';
import { llamarApi } from '@/lib/api';
import type { VistaReferidos } from '@/lib/referidos';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Referidos' };

async function Contenido() {
  await requerirSesion('CLIENT');
  const r = await llamarApi<VistaReferidos>('/referidos/mio', { token: await tokenDeSesion() });
  if (!r.ok) {
    return <p className="text-error">No pudimos cargar tus referidos: {r.error.mensaje}</p>;
  }
  return <VistaReferidor vista={r.datos} />;
}

export default function Referidos() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando tus referidos…</p>}>
      <Contenido />
    </Suspense>
  );
}
