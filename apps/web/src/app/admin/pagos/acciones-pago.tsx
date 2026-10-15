'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { avisar } from '@/components/panel/aviso-breve';
import { CuerpoLateral, Lateral, PieLateral, useCerrarLateral } from '@/components/panel/lateral';
import { Aviso, BotonEnviar, Campo } from '@/components/ui';
import {
  aprobarPago,
  cambiarAprobacionAutomatica,
  type EstadoPago,
  rechazarPago,
  verificarPago,
} from '../acciones';

/** Al terminar bien: aviso breve (y, dentro del panel lateral, se cierra). */
function useAlTerminar(estado: EstadoPago, alTerminar?: () => void) {
  const anterior = useRef(estado.listo);
  useEffect(() => {
    if (estado.listo && estado.listo !== anterior.current) {
      anterior.current = estado.listo;
      alTerminar?.();
      if (estado.aviso) avisar(estado.aviso);
    }
  }, [estado.listo, estado.aviso, alTerminar]);
}

function MensajeError({ estado }: { estado: EstadoPago }) {
  return estado.error ? (
    <p role="alert" className="basis-full text-sm text-error">
      {estado.error}
    </p>
  ) : null;
}

/**
 * Aprobar el pago. Verificado: la píldora naranja. Sin verificar: "Aprobar de todos modos", que pide confirmar
 * (el admin lo revisó en el explorador).
 */
export function AprobarPago({ numero, forzar }: { numero: string; forzar: boolean }) {
  const [estado, accion] = useActionState(aprobarPago, {} as EstadoPago);
  useAlTerminar(estado);
  return (
    <form
      action={accion}
      className="contents"
      onSubmit={(evento) => {
        if (
          forzar &&
          !window.confirm(
            `El pago ${numero} no pasó la verificación. ¿Lo revisaste en el explorador y quieres aprobarlo de todos modos?`,
          )
        ) {
          evento.preventDefault();
        }
      }}
    >
      <input type="hidden" name="numero" value={numero} />
      {forzar ? <input type="hidden" name="forzar" value="si" /> : null}
      <BotonEnviar
        variante={forzar ? 'enlace' : 'pildora'}
        enviando="Aprobando…"
        className={forzar ? 'text-ceniza hover:text-blanco' : undefined}
      >
        {forzar ? 'Aprobar de todos modos' : 'Aprobar pago'}
      </BotonEnviar>
      <MensajeError estado={estado} />
    </form>
  );
}

/** "Verificar de nuevo": mira la blockchain ahora, sin esperar al worker. */
export function VerificarPago({ numero }: { numero: string }) {
  const [estado, accion] = useActionState(verificarPago, {} as EstadoPago);
  useAlTerminar(estado);
  return (
    <form action={accion} className="contents">
      <input type="hidden" name="numero" value={numero} />
      <BotonEnviar
        variante="enlace"
        enviando="Verificando…"
        className="text-ceniza hover:text-blanco"
      >
        Verificar de nuevo
      </BotonEnviar>
      <MensajeError estado={estado} />
    </form>
  );
}

const MOTIVOS = [
  { valor: 'monto', texto: 'El monto no está completo' },
  { valor: 'red', texto: 'Lo envió por otra red o en otra moneda' },
  { valor: 'hash', texto: 'No encontramos la transacción' },
  { valor: 'otro', texto: 'Otro motivo' },
];

function FormularioRechazo({ numero, sugerido }: { numero: string; sugerido: string }) {
  const [estado, accion] = useActionState(rechazarPago, {} as EstadoPago);
  const cerrar = useCerrarLateral();
  useAlTerminar(estado, cerrar);
  return (
    <form action={accion} className="grid min-h-0 grid-rows-[1fr_auto]">
      <CuerpoLateral>
        <input type="hidden" name="numero" value={numero} />
        {estado.error ? <Aviso>{estado.error}</Aviso> : null}
        <fieldset className="grid gap-1">
          <legend className="mb-2 text-[15px] text-blanco">
            Motivo. Se lo enviamos al cliente por correo.
          </legend>
          {MOTIVOS.map((m) => (
            <label
              key={m.valor}
              className="opcion-plan grid cursor-pointer grid-cols-[20px_1fr] items-center gap-3.5 py-2.5 text-[15px] text-ceniza transition-colors duration-200"
            >
              <input
                type="radio"
                name="motivo"
                value={m.valor}
                defaultChecked={m.valor === sugerido}
              />
              {m.texto}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-2">
          <label htmlFor={`detalle-${numero}`} className="text-[15px] text-blanco">
            Detalle para el cliente (opcional)
          </label>
          <textarea
            id={`detalle-${numero}`}
            name="detalle"
            rows={4}
            maxLength={400}
            placeholder="Ej.: llegaron 115 USDT de 120. Envía los 5 que faltan y escríbenos."
            className="w-full resize-y rounded-[20px] bg-campo px-5 py-3.5 text-base text-blanco placeholder:text-white/35 focus-visible:bg-campo-foco focus-visible:shadow-[0_0_0_2px_var(--color-senal)] focus-visible:outline-none"
          />
        </div>
      </CuerpoLateral>
      <PieLateral>
        <BotonEnviar enviando="Rechazando…">Rechazar pago</BotonEnviar>
      </PieLateral>
    </form>
  );
}

/** Rechazar con motivo, en el panel lateral. */
export function RechazarPago({
  numero,
  cliente,
  sugerido,
}: {
  numero: string;
  cliente: string;
  sugerido: string;
}) {
  return (
    <Lateral titulo={`Rechazar el pago de ${cliente}`} boton="Rechazar" gris>
      <FormularioRechazo numero={numero} sugerido={sugerido} />
    </Lateral>
  );
}

/**
 * El interruptor de la aprobación automática. Encenderla pide el código de la app (acción delicada); apagarla, no.
 */
export function AprobacionAutomatica({ activa }: { activa: boolean }) {
  const [estado, accion] = useActionState(cambiarAprobacionAutomatica, {} as EstadoPago);
  const [pidiendoCodigo, setPidiendoCodigo] = useState(false);
  const alTerminar = () => setPidiendoCodigo(false);
  useAlTerminar(estado, alTerminar);
  return (
    <form action={accion} className="grid max-w-[30rem] justify-items-start gap-4">
      <input type="hidden" name="activa" value={activa ? 'no' : 'si'} />
      <div className="flex items-center gap-3.5">
        <button
          type={activa ? 'submit' : 'button'}
          role="switch"
          aria-checked={activa}
          aria-labelledby="t-automatica"
          onClick={() => {
            if (!activa) setPidiendoCodigo(true);
          }}
          className="relative h-7 w-12 shrink-0 rounded-full bg-campo-foco transition-colors duration-200 aria-checked:bg-llama"
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 left-1 size-5 rounded-full bg-blanco transition-transform duration-200 ease-salida motion-reduce:transition-none ${
              activa ? 'translate-x-5' : ''
            }`}
          />
        </button>
        <span id="t-automatica" className="grid text-[15px] text-blanco">
          Aprobar solos los pagos verificados
          <small className="text-[13px] text-ceniza">
            {activa
              ? 'Encendido: los verificados se aprueban solos'
              : 'Apagado: tú apruebas cada pago'}
          </small>
        </span>
      </div>
      {pidiendoCodigo && !activa ? (
        <div className="grid w-full gap-3">
          <Campo
            etiqueta="Para encenderla, escribe el código de tu app"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <BotonEnviar variante="enlace" enviando="Encendiendo…">
              Encender
            </BotonEnviar>
            <button
              type="button"
              onClick={() => setPidiendoCodigo(false)}
              className="inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      <MensajeError estado={estado} />
    </form>
  );
}
