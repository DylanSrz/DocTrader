'use client';

import { useActionState } from 'react';
import { Aviso, BotonEnviar, CampoContrasena, Enlace, Pildora } from '@/components/ui';
import type { EstadoFormulario } from '@/lib/formulario';
import { restablecer } from '../acciones';
import { useTokenDelEnlace } from '../token-del-enlace';

export function FormularioRestablecer() {
  const token = useTokenDelEnlace();
  const [estado, accion] = useActionState(restablecer, {} as EstadoFormulario);

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
  if (token === null) {
    return (
      <div className="grid gap-6">
        <Aviso>
          Este enlace no está completo. Abre el enlace del correo otra vez o pide uno nuevo.
        </Aviso>
        <Enlace href="/recuperar">Pedir un enlace nuevo</Enlace>
      </div>
    );
  }

  return (
    <form action={accion} className="grid gap-6" noValidate>
      <input type="hidden" name="token" value={token ?? ''} />
      {estado.mensaje ? (
        <Aviso>
          {estado.mensaje}{' '}
          <Enlace href="/recuperar" className="min-h-0 text-[15px] text-error">
            Pedir un enlace nuevo
          </Enlace>
        </Aviso>
      ) : null}
      <CampoContrasena
        etiqueta="Contraseña nueva"
        name="contrasena"
        autoComplete="new-password"
        required
        minLength={10}
        maxLength={128}
        autoFocus
        error={estado.campos?.contrasena}
      />
      <BotonEnviar enviando="Guardando…" disabled={!token} className="justify-self-start">
        Guardar contraseña
      </BotonEnviar>
    </form>
  );
}
