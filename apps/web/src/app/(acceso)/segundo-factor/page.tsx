import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PlantillaAcceso } from '@/components/plantilla-acceso';
import { inicioDe, obtenerSesion } from '@/lib/sesion';
import { redirect } from 'next/navigation';
import { ConfigurarSegundoFactor } from './configurar';

export const metadata: Metadata = { title: 'Segundo factor' };

async function Contenido() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.estado === 'SEGUNDO_FACTOR_PENDIENTE') redirect('/ingresar');
  // Siempre el mismo componente: al activar, la cookie cambia y esta parte se vuelve a pintar; el componente
  // conserva su paso y así los códigos de recuperación siguen en pantalla.
  return (
    <ConfigurarSegundoFactor
      obligatorio={sesion.estado === 'SEGUNDO_FACTOR_POR_CONFIGURAR'}
      yaActivo={sesion.usuario.segundoFactor}
      inicio={inicioDe(sesion.usuario.rol)}
    />
  );
}

export default function SegundoFactor() {
  return (
    <PlantillaAcceso
      etiqueta="Segundo factor"
      titulo="Protege tu cuenta con tu celular."
      texto={
        <p>
          Además de la contraseña, al ingresar te pediremos un código de 6 dígitos que cambia cada
          30 segundos en una app de autenticación: Google Authenticator, Microsoft Authenticator,
          1Password o la que prefieras.
        </p>
      }
    >
      <Suspense fallback={<p className="text-ceniza">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </PlantillaAcceso>
  );
}
