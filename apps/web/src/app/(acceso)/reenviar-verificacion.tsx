'use client';

import { useActionState } from 'react';
import { Turnstile } from '@/components/turnstile';
import { Aviso, BotonEnviar } from '@/components/ui';
import type { EstadoFormulario } from '@/lib/formulario';
import { reenviarVerificacion } from './acciones';

/** "No me llegó el correo": pide un enlace de verificación nuevo. */
export function ReenviarVerificacion({ correo }: { correo: string }) {
  const [estado, accion] = useActionState(reenviarVerificacion, {} as EstadoFormulario);
  return (
    <form action={accion} className="grid gap-4" noValidate>
      <input type="hidden" name="correo" value={correo} />
      {estado.mensaje ? (
        <Aviso tono={estado.exito ? 'exito' : 'error'}>{estado.mensaje}</Aviso>
      ) : null}
      <Turnstile key={estado.envio} />
      <BotonEnviar enviando="Enviando…" variante="enlace" className="justify-self-start">
        Enviar el enlace otra vez
      </BotonEnviar>
    </form>
  );
}
