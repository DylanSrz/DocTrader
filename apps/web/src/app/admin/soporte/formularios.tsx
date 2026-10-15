'use client';

import { LIMITES_TICKET, PRIORIDAD_TICKET, type PrioridadTicket } from '@doctrader/shared';
import { useActionState, useRef, useState } from 'react';
import { conAviso, ErrorOperacion, useAlListo } from '@/components/admin/operacion';
import { Adjuntos } from '@/components/soporte/adjuntos';
import { AreaTexto } from '@/components/soporte/area-texto';
import { BotonEnviar, Casilla, Selector } from '@/components/ui';
import type { RespuestaGuardada } from '@/lib/soporte';
import {
  cambiarTicket,
  type EstadoSoporteAdmin,
  resolverTicketAdmin,
  responderTicketAdmin,
} from './acciones';

const cambiarTicketConAviso = conAviso(cambiarTicket);
const responderConAviso = conAviso(responderTicketAdmin);
const resolverConAviso = conAviso(resolverTicketAdmin);

/** Asignado y prioridad: se guardan apenas se elige otra opción. */
export function AjustesTicket({
  numero,
  asignadoA,
  prioridad,
  admins,
}: {
  numero: number;
  asignadoA: string | null;
  prioridad: PrioridadTicket;
  admins: { id: string; nombre: string }[];
}) {
  const [estado, accion, enviando] = useActionState(
    cambiarTicketConAviso,
    {} as EstadoSoporteAdmin,
  );
  const formulario = useRef<HTMLFormElement>(null);
  const enviar = () => formulario.current?.requestSubmit();
  return (
    <form
      ref={formulario}
      action={accion}
      aria-busy={enviando}
      className="grid grid-cols-2 items-start gap-x-4 gap-y-3 max-sm:grid-cols-1"
    >
      <input type="hidden" name="numero" value={numero} />
      <Selector
        etiqueta="Asignado a"
        name="asignadoA"
        defaultValue={asignadoA ?? ''}
        onChange={enviar}
        error={estado.campos?.asignadoA}
      >
        <option value="">Sin asignar</option>
        {admins.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre}
          </option>
        ))}
      </Selector>
      <Selector etiqueta="Prioridad" name="prioridad" defaultValue={prioridad} onChange={enviar}>
        <option value={PRIORIDAD_TICKET.NORMAL}>Normal</option>
        <option value={PRIORIDAD_TICKET.ALTA}>Alta</option>
      </Selector>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </form>
  );
}

/**
 * Responder al cliente o dejar una nota interna. Una respuesta guardada se agrega al texto (no lo reemplaza) para
 * poder ajustarla antes de enviar.
 */
export function ResponderAdmin({
  numero,
  respuestas,
  adjuntos,
}: {
  numero: number;
  respuestas: RespuestaGuardada[];
  adjuntos: boolean;
}) {
  const [estado, accion] = useActionState(responderConAviso, {} as EstadoSoporteAdmin);
  const [interna, setInterna] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const caja = useRef<HTMLTextAreaElement>(null);
  // Después de enviar, el formulario vuelve a ser una respuesta al cliente.
  useAlListo(estado, () => setInterna(false));

  function usarRespuesta(id: string) {
    const r = respuestas.find((x) => x.id === id);
    const area = caja.current;
    if (!r || !area) return;
    area.value = area.value.trim() ? `${area.value.trimEnd()}\n\n${r.cuerpo}` : r.cuerpo;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  }

  return (
    // La key limpia el texto, la casilla y los adjuntos después de enviar.
    <form key={estado.listo ?? 0} action={accion} noValidate className="grid gap-[18px]">
      <input type="hidden" name="numero" value={numero} />
      {respuestas.length > 0 ? (
        <Selector
          etiqueta="Respuesta guardada (opcional)"
          value=""
          onChange={(e) => usarRespuesta(e.currentTarget.value)}
        >
          <option value="">Escribir desde cero</option>
          {respuestas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.titulo}
            </option>
          ))}
        </Selector>
      ) : null}
      <AreaTexto
        ref={caja}
        etiqueta={interna ? 'Nota interna' : 'Mensaje para el cliente'}
        name="mensaje"
        rows={6}
        maxLength={LIMITES_TICKET.mensaje.maximo}
        defaultValue={estado.valores?.mensaje}
        error={estado.campos?.mensaje}
      />
      <Casilla
        name="interna"
        checked={interna}
        onChange={(e) => setInterna(e.currentTarget.checked)}
      >
        Nota interna
        <small className="block text-[13px] text-ceniza">
          Solo la ven los administradores; el cliente no recibe correo.
        </small>
      </Casilla>
      {adjuntos ? <Adjuntos onSubiendo={setSubiendo} /> : null}
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <BotonEnviar enviando="Enviando…" disabled={subiendo}>
          {subiendo ? 'Subiendo archivos…' : interna ? 'Guardar nota' : 'Enviar respuesta'}
        </BotonEnviar>
      </div>
    </form>
  );
}

export function ResolverAdmin({ numero }: { numero: number }) {
  const [estado, accion] = useActionState(resolverConAviso, {} as EstadoSoporteAdmin);
  return (
    <form action={accion} className="grid justify-items-start gap-2">
      <input type="hidden" name="numero" value={numero} />
      <BotonEnviar variante="enlace" enviando="Marcando…" className="text-ceniza hover:text-blanco">
        Marcar como resuelto
      </BotonEnviar>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </form>
  );
}
