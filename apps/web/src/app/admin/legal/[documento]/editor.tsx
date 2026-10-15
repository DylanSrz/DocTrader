'use client';

import type { TipoDocumentoLegal } from '@doctrader/shared';
import { useActionState } from 'react';
import { Aviso, BotonEnviar, Campo } from '@/components/ui';
import { type EstadoPublicacion, publicarLegal } from '../../acciones';

/** Editar un texto legal en Markdown y publicarlo como versión nueva, confirmando con el código de la app. */
export function EditorLegal({
  tipo,
  contenido,
  siguienteVersion,
}: {
  tipo: TipoDocumentoLegal;
  contenido: string;
  siguienteVersion: number;
}) {
  const [estado, accion] = useActionState(publicarLegal, {} as EstadoPublicacion);

  return (
    <form action={accion} className="grid gap-8">
      <input type="hidden" name="tipo" value={tipo} />
      <div className="grid gap-2">
        <label htmlFor="contenido" className="text-[15px] text-blanco">
          Texto en Markdown
        </label>
        <p className="text-sm text-ceniza">
          Títulos con <span className="text-blanco">##</span>, listas con{' '}
          <span className="text-blanco">-</span>, negrita con{' '}
          <span className="text-blanco">**texto**</span>. El HTML no se muestra.
        </p>
        <textarea
          id="contenido"
          name="contenido"
          defaultValue={contenido}
          required
          spellCheck
          className="min-h-[60svh] w-full resize-y rounded-[16px] bg-campo px-5 py-4 font-mono text-[15px] leading-[1.6] text-blanco focus-visible:bg-campo-foco focus-visible:shadow-[0_0_0_2px_var(--color-senal)] focus-visible:outline-none"
        />
      </div>
      <div className="grid max-w-[28rem] gap-6">
        {estado.error ? <Aviso>{estado.error}</Aviso> : null}
        {estado.publicada ? (
          <Aviso tono="exito">
            Publicada la versión {estado.publicada}. La página pública ya la muestra.
          </Aviso>
        ) : null}
        <Campo
          etiqueta="Para publicar, escribe el código de tu app"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
        />
        <BotonEnviar enviando="Publicando…" className="justify-self-start">
          Publicar versión {estado.publicada ? estado.publicada + 1 : siguienteVersion}
        </BotonEnviar>
      </div>
    </form>
  );
}
