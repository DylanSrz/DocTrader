import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PlantillaAcceso } from '@/components/plantilla-acceso';
import { inicioDe, obtenerSesion } from '@/lib/sesion';
import { FormularioIngreso } from './formulario';

export const metadata: Metadata = { title: 'Ingresar' };

/** Con una sesión completa no hay nada que ingresar: va directo a su panel. */
async function SiYaIngreso() {
  const sesion = await obtenerSesion();
  if (sesion?.estado === 'COMPLETA') redirect(inicioDe(sesion.usuario.rol));
  return null;
}

export default function Ingresar() {
  return (
    <PlantillaAcceso
      etiqueta="Tu panel"
      titulo="Ingresa a tu cuenta."
      texto="Desde tu panel compras y renuevas licencias, ves tus pagos y hablas con soporte."
    >
      <Suspense>
        <SiYaIngreso />
      </Suspense>
      <FormularioIngreso />
    </PlantillaAcceso>
  );
}
