import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PlantillaAcceso } from '@/components/plantilla-acceso';
import { codigoGuardado, invitacion } from '@/lib/referidos';
import { FormularioRegistro } from './formulario';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  // Dirección oficial para los buscadores: "/registro?plan=…" cuenta como esta misma página.
  alternates: { canonical: '/registro' },
};

export default function Registro() {
  return (
    <PlantillaAcceso
      etiqueta="Crear cuenta"
      titulo="Empieza con tu cuenta."
      texto={
        <p>
          Con tu cuenta registras tus cuentas de trading y compras una licencia para cada una. Tu
          documento de identidad se guarda cifrado y solo lo ve el administrador.
        </p>
      }
    >
      {/* Lo único que depende de la cookie del enlace de referido: el resto de la página sigue estático. */}
      <Suspense fallback={null}>
        <Invitacion />
      </Suspense>
      <FormularioRegistro />
    </PlantillaAcceso>
  );
}

/** "Te invitó: Ana M." si llegó por un enlace de referido que sirve hoy. */
async function Invitacion() {
  const nombre = await invitacion(await codigoGuardado());
  if (!nombre) return null;
  return (
    <p className="mb-8 flex items-center gap-3 rounded-[20px] bg-white/6 px-5 py-4 text-[15px] text-niebla">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-senal" />
      <span>
        {/* El nombre ya termina en punto ("Ana M."): no se agrega otro. */}
        Te invitó <b className="font-medium text-blanco">{nombre}</b>
        {nombre.endsWith('.') ? '' : '.'}
      </span>
    </p>
  );
}
