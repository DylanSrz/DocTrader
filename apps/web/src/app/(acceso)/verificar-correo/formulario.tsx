'use client';

import { useActionState } from 'react';
import { Aviso, BotonEnviar, Enlace, Pildora } from '@/components/ui';
import type { EstadoFormulario } from '@/lib/formulario';
import { verificarCorreo } from '../acciones';
import { useTokenDelEnlace } from '../token-del-enlace';

/**
 * El correo se confirma con un botón y no al abrir el enlace: algunos lectores de correo abren los enlaces solos
 * para revisarlos, y eso no debe contar como confirmación.
 */
export function FormularioVerificar() {
  const token = useTokenDelEnlace();
  const [estado, accion] = useActionState(verificarCorreo, {} as EstadoFormulario);

  if (estado.exito) {
    return (
      <div className="grid gap-6">
        <Aviso tono="exito">{estado.mensaje}</Aviso>
        <Pildora href="/ingresar" className="justify-self-start">
          Ingresar
        </Pildora>
      </div>
    );
  }
  if (token === null || estado.mensaje) {
    return (
      <div className="grid gap-6">
        <Aviso>
          {estado.mensaje ?? 'Este enlace no está completo. Abre el enlace del correo otra vez.'}
        </Aviso>
        <p className="text-[15px] text-niebla">
          Para recibir un enlace nuevo, intenta{' '}
          <Enlace href="/ingresar" className="text-[15px]">
            ingresar
          </Enlace>{' '}
          con tu correo y contraseña.
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="grid gap-6">
      <input type="hidden" name="token" value={token ?? ''} />
      <BotonEnviar enviando="Confirmando…" disabled={!token} className="justify-self-start">
        Confirmar mi correo
      </BotonEnviar>
    </form>
  );
}
