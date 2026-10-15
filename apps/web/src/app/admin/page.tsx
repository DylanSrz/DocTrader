import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Seguridad } from '@/components/panel/seguridad';
import { Etiqueta } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Administración' };

async function Contenido() {
  const sesion = await requerirSesion('ADMIN');
  const resumen = await llamarApi<{ clientes: number; clientesVerificados: number }>(
    '/admin/resumen',
    { token: await tokenDeSesion() },
  );
  const clientes = resumen.ok ? resumen.datos.clientes : 0;
  const verificados = resumen.ok ? resumen.datos.clientesVerificados : 0;
  return (
    <div className="grid gap-[clamp(64px,8vw,120px)]">
      <div className="grid gap-6">
        <Etiqueta>Hoy</Etiqueta>
        <h1 className="max-w-[16ch] text-grande">
          {clientes === 1 ? '1 cliente registrado.' : `${clientes} clientes registrados.`}
        </h1>
        <p className="max-w-[34em] text-niebla">
          {verificados} con el correo confirmado. Las listas por conectar y por desconectar, los
          pagos y las licencias llegan en las próximas etapas.
        </p>
      </div>
      <Seguridad sesion={sesion} />
    </div>
  );
}

export default function Admin() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}
