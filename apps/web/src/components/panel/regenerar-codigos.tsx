'use client';

import { useActionState, useState } from 'react';
import { type EstadoCodigos, regenerarCodigos } from '@/app/acciones-cuenta';
import { Aviso, BotonEnviar, Campo } from '@/components/ui';

/** Códigos de recuperación nuevos, con confirmación reciente: primero el código de la app. */
export function RegenerarCodigos() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(regenerarCodigos, {} as EstadoCodigos);

  if (estado.codigos) {
    return (
      <div className="grid max-w-[34em] gap-4">
        <Aviso tono="exito">
          Estos son tus códigos nuevos. Los anteriores ya no sirven. Guárdalos ahora: no los
          volverás a ver.
        </Aviso>
        <ol
          className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-pildora bg-campo px-6 py-5 cifra text-[17px] select-all"
          translate="no"
        >
          {estado.codigos.map((codigo) => (
            <li key={codigo}>{codigo}</li>
          ))}
        </ol>
      </div>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex min-h-11 items-center justify-self-start text-sm text-blanco underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
      >
        Generar códigos de recuperación nuevos
      </button>
    );
  }

  return (
    <form action={accion} className="grid max-w-[24rem] gap-4" noValidate>
      {estado.error ? <Aviso>{estado.error}</Aviso> : null}
      <Campo
        etiqueta="Para confirmar que eres tú, escribe el código de tu app"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        maxLength={6}
        autoFocus
      />
      <BotonEnviar enviando="Generando…" variante="enlace" className="justify-self-start">
        Generar códigos nuevos
      </BotonEnviar>
    </form>
  );
}
