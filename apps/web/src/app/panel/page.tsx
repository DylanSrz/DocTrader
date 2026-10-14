import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Seguridad } from '@/components/panel/seguridad';
import { Etiqueta } from '@/components/ui';
import { requerirSesion } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Mis cuentas' };

async function Contenido() {
  const sesion = await requerirSesion('CLIENT');
  const nombre = sesion.usuario.nombre.split(' ')[0];
  return (
    <div className="grid gap-[clamp(64px,8vw,120px)]">
      <div className="grid gap-6">
        <Etiqueta>Mis cuentas</Etiqueta>
        <h1 className="max-w-[14ch] text-grande">Hola, {nombre}. Tu cuenta está lista.</h1>
        <p className="max-w-[34em] text-niebla">
          Muy pronto vas a poder agregar aquí tus cuentas de trading y comprar la licencia de cada
          una. Te avisaremos por correo.
        </p>
      </div>
      <Seguridad sesion={sesion} />
    </div>
  );
}

export default function Panel() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando tu panel…</p>}>
      <Contenido />
    </Suspense>
  );
}
