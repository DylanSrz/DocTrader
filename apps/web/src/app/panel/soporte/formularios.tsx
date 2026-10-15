'use client';

import { type EstadoTicket, LIMITES_TICKET, NOMBRE_TEMA, TEMA_TICKET } from '@doctrader/shared';
import { useActionState, useState } from 'react';
import { useCerrarLateral } from '@/components/panel/lateral';
import { Adjuntos } from '@/components/soporte/adjuntos';
import { AreaTexto } from '@/components/soporte/area-texto';
import { BotonEnviar, Campo, Selector } from '@/components/ui';
import type { MisTickets } from '@/lib/soporte';
import { crearTicket, type EstadoSoporte, resolverTicket, responderTicket } from './acciones';

function ErrorGeneral({ estado }: { estado: EstadoSoporte }) {
  return estado.error ? (
    <p role="alert" className="text-sm text-error">
      {estado.error}
    </p>
  ) : null;
}

/** Abrir un ticket: tema, cuenta u orden relacionada, asunto, mensaje y adjuntos. */
export function NuevoTicket({
  cuentas,
  ordenes,
  adjuntos,
  inicial,
}: Pick<MisTickets, 'cuentas' | 'ordenes' | 'adjuntos'> & {
  inicial: { tema?: string; relacion?: string };
}) {
  const [estado, accion] = useActionState(crearTicket, {} as EstadoSoporte);
  const [subiendo, setSubiendo] = useState(false);
  const cerrar = useCerrarLateral();
  const v = estado.valores ?? {};
  const { asunto, primerMensaje } = LIMITES_TICKET;
  return (
    <form action={accion} noValidate className="grid gap-[22px]">
      <p className="text-sm text-ceniza">
        Te respondemos en este panel y te avisamos al correo de tu cuenta. Nunca te pediremos tus
        contraseñas por aquí.
      </p>
      <Selector
        etiqueta="Tema"
        name="tema"
        defaultValue={v.tema ?? inicial.tema ?? TEMA_TICKET.PAGOS}
        error={estado.campos?.tema}
      >
        {Object.values(TEMA_TICKET).map((t) => (
          <option key={t} value={t}>
            {NOMBRE_TEMA[t]}
          </option>
        ))}
      </Selector>
      {cuentas.length + ordenes.length > 0 ? (
        <Selector
          etiqueta="Cuenta u orden relacionada (opcional)"
          name="relacion"
          defaultValue={v.relacion ?? inicial.relacion ?? ''}
          error={estado.campos?.relacion}
        >
          <option value="">Ninguna en particular</option>
          {cuentas.length > 0 ? (
            <optgroup label="Cuentas de trading">
              {cuentas.map((c) => (
                <option key={c.id} value={`cuenta:${c.id}`}>
                  Cuenta {c.numero} ({c.broker})
                </option>
              ))}
            </optgroup>
          ) : null}
          {ordenes.length > 0 ? (
            <optgroup label="Órdenes de pago">
              {ordenes.map((o) => (
                <option key={o.id} value={`orden:${o.id}`}>
                  {o.numero}, {o.plan.toLowerCase()}, cuenta {o.cuenta}
                </option>
              ))}
            </optgroup>
          ) : null}
        </Selector>
      ) : null}
      <Campo
        etiqueta="Asunto"
        name="asunto"
        autoComplete="off"
        placeholder="Ej.: Mi cuenta sigue por conectar"
        required
        minLength={asunto.minimo}
        maxLength={asunto.maximo}
        defaultValue={v.asunto}
        error={estado.campos?.asunto}
      />
      <AreaTexto
        etiqueta="Cuéntanos qué pasa"
        name="mensaje"
        rows={6}
        required
        minLength={primerMensaje.minimo}
        maxLength={primerMensaje.maximo}
        defaultValue={v.mensaje}
        ayuda="Si es un pago, incluye la red y el código de la transacción (hash)."
        error={estado.campos?.mensaje}
      />
      {adjuntos ? <Adjuntos onSubiendo={setSubiendo} /> : null}
      <ErrorGeneral estado={estado} />
      <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3 pt-2">
        <button
          type="button"
          onClick={cerrar}
          className="inline-flex min-h-11 items-center text-sm text-blanco underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
        >
          Cancelar
        </button>
        <BotonEnviar enviando="Enviando…" disabled={subiendo}>
          {subiendo ? 'Subiendo archivos…' : 'Enviar ticket'}
        </BotonEnviar>
      </div>
    </form>
  );
}

/**
 * Responder en el ticket. En uno resuelto, escribir lo abre de nuevo. "Mi problema ya se resolvió" va aparte: es
 * otra acción.
 */
export function Responder({
  numero,
  estadoTicket,
  adjuntos,
}: {
  numero: number;
  estadoTicket: EstadoTicket;
  adjuntos: boolean;
}) {
  const [estado, accion] = useActionState(responderTicket, {} as EstadoSoporte);
  const [resuelto, resolver] = useActionState(resolverTicket, {} as EstadoSoporte);
  const [subiendo, setSubiendo] = useState(false);
  const reabrir = estadoTicket === 'RESUELTO';
  return (
    <div className="grid gap-4">
      {/* La key limpia el texto y los adjuntos después de enviar. */}
      <form key={estado.listo ?? 0} action={accion} noValidate className="grid gap-[18px]">
        <input type="hidden" name="numero" value={numero} />
        <AreaTexto
          etiqueta={reabrir ? 'Si el problema volvió, cuéntanos qué pasa' : 'Tu respuesta'}
          name="mensaje"
          rows={4}
          required
          maxLength={LIMITES_TICKET.mensaje.maximo}
          defaultValue={estado.valores?.mensaje}
          error={estado.campos?.mensaje}
        />
        {adjuntos ? <Adjuntos onSubiendo={setSubiendo} /> : null}
        <ErrorGeneral estado={estado} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <BotonEnviar enviando="Enviando…" disabled={subiendo}>
            {subiendo ? 'Subiendo archivos…' : reabrir ? 'Abrir de nuevo' : 'Enviar respuesta'}
          </BotonEnviar>
        </div>
      </form>
      {reabrir ? null : (
        <form action={resolver} className="grid justify-items-start gap-2">
          <input type="hidden" name="numero" value={numero} />
          <BotonEnviar
            variante="enlace"
            enviando="Marcando…"
            className="text-ceniza hover:text-blanco"
          >
            Mi problema ya se resolvió
          </BotonEnviar>
          <ErrorGeneral estado={resuelto} />
        </form>
      )}
    </div>
  );
}
