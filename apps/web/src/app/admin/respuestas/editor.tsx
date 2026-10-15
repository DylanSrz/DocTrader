'use client';

import { LIMITES_TICKET } from '@doctrader/shared';
import { useActionState, useState } from 'react';
import { conAviso, ErrorOperacion } from '@/components/admin/operacion';
import { AreaTexto } from '@/components/soporte/area-texto';
import { BotonEnviar, Campo } from '@/components/ui';
import type { RespuestaGuardada } from '@/lib/soporte';
import { borrarRespuesta, type EstadoSoporteAdmin, guardarRespuesta } from '../soporte/acciones';

const guardarConAviso = conAviso(guardarRespuesta);
const borrarConAviso = conAviso(borrarRespuesta);
const { titulo, cuerpo } = LIMITES_TICKET.respuestaGuardada;

/** Una respuesta guardada (o una nueva, sin `respuesta`). Borrar pide un segundo clic. */
export function EditarRespuesta({ respuesta }: { respuesta?: RespuestaGuardada }) {
  const [estado, accion] = useActionState(guardarConAviso, {} as EstadoSoporteAdmin);
  const [borrado, borrar] = useActionState(borrarConAviso, {} as EstadoSoporteAdmin);
  const [confirmando, setConfirmando] = useState(false);
  const v = estado.valores;
  return (
    <div className="grid gap-4">
      {/* Una nueva se limpia al guardarla. */}
      <form
        key={respuesta ? respuesta.id : (estado.listo ?? 0)}
        action={accion}
        noValidate
        className="grid gap-[18px]"
      >
        {respuesta ? <input type="hidden" name="id" value={respuesta.id} /> : null}
        <Campo
          etiqueta="Título"
          name="titulo"
          autoComplete="off"
          minLength={titulo.minimo}
          maxLength={titulo.maximo}
          defaultValue={v?.titulo ?? respuesta?.titulo}
          placeholder="Ej.: Pedir el hash del pago"
          error={estado.campos?.titulo}
          className="max-w-[30rem]"
        />
        <AreaTexto
          etiqueta="Respuesta"
          name="cuerpo"
          rows={6}
          minLength={cuerpo.minimo}
          maxLength={cuerpo.maximo}
          defaultValue={v?.cuerpo ?? respuesta?.cuerpo}
          ayuda={
            respuesta
              ? undefined
              : 'Habla en plural ("revisamos tu pago"): el cliente ve las respuestas firmadas por DocTrader Pro.'
          }
          error={estado.campos?.cuerpo}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <BotonEnviar variante="enlace" enviando="Guardando…">
            {respuesta ? 'Guardar cambios' : 'Agregar respuesta'}
          </BotonEnviar>
          {respuesta && !confirmando ? (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="inline-flex min-h-11 items-center text-sm text-error underline decoration-current/40 underline-offset-[6px] hover:decoration-current"
            >
              Borrar
            </button>
          ) : null}
        </div>
        {estado.error ? <ErrorOperacion estado={estado} /> : null}
      </form>
      {respuesta && confirmando ? (
        <form action={borrar} className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <input type="hidden" name="id" value={respuesta.id} />
          <BotonEnviar
            variante="enlace"
            enviando="Borrando…"
            className="text-error decoration-current/40"
          >
            Sí, borrar «{respuesta.titulo}»
          </BotonEnviar>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco"
          >
            Cancelar
          </button>
          {borrado.error ? <ErrorOperacion estado={borrado} /> : null}
        </form>
      ) : null}
    </div>
  );
}
