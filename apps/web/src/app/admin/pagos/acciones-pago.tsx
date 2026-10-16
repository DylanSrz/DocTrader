'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { LIMITES_ADMIN } from '@doctrader/shared';
import { CampoCodigo, conAviso, ErrorOperacion, useAlListo } from '@/components/admin/operacion';
import { CuerpoLateral, Lateral, PieLateral, useCerrarLateral } from '@/components/panel/lateral';
import { Aviso, BotonEnviar, Campo } from '@/components/ui';
import {
  aprobarPago,
  cambiarAprobacionAutomatica,
  type EstadoPago,
  rechazarPago,
  verificarPago,
} from '../acciones';
import { type EstadoOperacion, registrarPagoManual } from '../acciones-operacion';

// El aviso sale desde la acción: al aprobar, el pago sale de la lista y su efecto ya no correría.
const aprobarPagoConAviso = conAviso(aprobarPago);
const rechazarPagoConAviso = conAviso(rechazarPago);
const verificarPagoConAviso = conAviso(verificarPago);
const cambiarAprobacionAutomaticaConAviso = conAviso(cambiarAprobacionAutomatica);
const registrarPagoManualConAviso = conAviso(registrarPagoManual);

/** Al terminar bien, dentro del panel lateral: se cierra. */
function useAlTerminar(estado: EstadoPago, alTerminar?: () => void) {
  const anterior = useRef(estado.listo);
  useEffect(() => {
    if (estado.listo && estado.listo !== anterior.current) {
      anterior.current = estado.listo;
      alTerminar?.();
    }
  }, [estado.listo, alTerminar]);
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
  const [estado, accion] = useActionState(aprobarPagoConAviso, {} as EstadoPago);

  return (
    <form
      action={accion}
      className="contents"
      onSubmit={(evento) => {
        if (
          forzar &&
          !window.confirm(
            `El pago ${numero} no pasó la verificación. ¿Lo revisaste (en el explorador o en Binance) y quieres aprobarlo de todos modos?`,
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
  const [estado, accion] = useActionState(verificarPagoConAviso, {} as EstadoPago);

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
  const [estado, accion] = useActionState(rechazarPagoConAviso, {} as EstadoPago);
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
  const [estado, accion] = useActionState(cambiarAprobacionAutomaticaConAviso, {} as EstadoPago);
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
          className="relative h-7 w-12 shrink-0 rounded-full bg-campo-foco transition-colors duration-200 before:absolute before:-inset-2 before:content-[''] aria-checked:bg-llama"
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

function FormularioPagoManual({ numero }: { numero: string }) {
  const [estado, accion] = useActionState(registrarPagoManualConAviso, {} as EstadoOperacion);
  const cerrar = useCerrarLateral();
  useAlListo(estado, cerrar);
  const v = estado.valores ?? {};
  return (
    <form action={accion} className="grid min-h-0 grid-rows-[1fr_auto]">
      <CuerpoLateral>
        <input type="hidden" name="numero" value={numero} />
        <p className="text-sm text-niebla">
          Solo si confirmaste que el dinero llegó completo (por ejemplo, en Binance → Historial de
          depósitos). La licencia queda activa como con cualquier pago aprobado y queda registrado
          quién lo hizo.
        </p>
        <div className="grid gap-2">
          <label htmlFor={`motivo-manual-${numero}`} className="text-[15px] text-blanco">
            Cómo lo verificaste
          </label>
          <textarea
            id={`motivo-manual-${numero}`}
            name="motivo"
            rows={3}
            required
            minLength={LIMITES_ADMIN.motivo.minimo}
            maxLength={LIMITES_ADMIN.motivo.maximo}
            defaultValue={v.motivo}
            placeholder="Ej.: pagó desde Binance; revisado en el historial de depósitos."
            aria-invalid={estado.campos?.motivo ? true : undefined}
            className="w-full resize-y rounded-[20px] bg-campo px-5 py-3.5 text-base text-blanco placeholder:text-white/35 focus-visible:bg-campo-foco focus-visible:shadow-[0_0_0_2px_var(--color-senal)] focus-visible:outline-none"
          />
        </div>
        <Campo
          etiqueta="Hash o número de transferencia de Binance (opcional)"
          name="referencia"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={200}
          placeholder="Ej.: Off-chain Transfer 421231346716"
          ayuda="Si lo tienes, escríbelo: así nadie puede usarlo en otra orden."
          defaultValue={v.referencia}
          error={estado.campos?.referencia}
        />
        <CampoCodigo estado={estado} accion="registrar el pago" />
        <ErrorOperacion estado={estado} />
      </CuerpoLateral>
      <PieLateral>
        <BotonEnviar enviando="Registrando…">Registrar y aprobar</BotonEnviar>
      </PieLateral>
    </form>
  );
}

/** Registrar a mano el pago de una orden vencida, en el panel lateral. */
export function RegistrarPagoManual({ numero, cliente }: { numero: string; cliente: string }) {
  return (
    <Lateral titulo={`Registrar el pago de ${cliente}`} boton="Registrar pago" gris>
      <FormularioPagoManual numero={numero} />
    </Lateral>
  );
}
