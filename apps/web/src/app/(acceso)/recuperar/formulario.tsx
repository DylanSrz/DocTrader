'use client';

import { useActionState } from 'react';
import { Turnstile } from '@/components/turnstile';
import { Aviso, BotonEnviar, Campo, Enlace } from '@/components/ui';
import type { EstadoFormulario } from '@/lib/formulario';
import { recuperar } from '../acciones';

export function FormularioRecuperar() {
  const [estado, accion] = useActionState(recuperar, {} as EstadoFormulario);

  if (estado.exito) {
    return (
      <div className="grid gap-6">
        <Aviso tono="exito">{estado.mensaje}</Aviso>
        <Enlace href="/ingresar">Volver a ingresar</Enlace>
      </div>
    );
  }

  return (
    <form action={accion} className="grid gap-6" noValidate>
      {estado.mensaje ? <Aviso>{estado.mensaje}</Aviso> : null}
      <Campo
        etiqueta="Correo"
        name="correo"
        type="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={estado.valores?.correo}
        error={estado.campos?.correo}
      />
      <Turnstile key={estado.envio} />
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <BotonEnviar enviando="Enviando…">Enviar enlace</BotonEnviar>
        <Enlace href="/ingresar" gris>
          Volver a ingresar
        </Enlace>
      </div>
    </form>
  );
}
