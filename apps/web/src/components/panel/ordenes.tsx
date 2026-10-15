'use client';

import { type KeyboardEvent, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { cancelarOrden, crearOrden, type EstadoPanel, reportarPago } from '@/app/panel/acciones';
import { Aviso, BotonEnviar, Campo, cx } from '@/components/ui';
import { avisar } from './aviso-breve';
import { CuerpoLateral, PieLateral } from './lateral';
import type { PlanOpcion } from './formulario-cuenta';

/** Elegir la licencia de una cuenta sin pagar (o vencida) y crear su orden. Va en el panel lateral. */
export function ElegirPlan({ cuentaId, planes }: { cuentaId: string; planes: PlanOpcion[] }) {
  const [estado, accion] = useActionState(crearOrden, {} as EstadoPanel);
  return (
    <form action={accion} className="grid min-h-0 grid-rows-[1fr_auto]">
      <CuerpoLateral>
        {estado.mensaje ? <Aviso>{estado.mensaje}</Aviso> : null}
        <input type="hidden" name="cuentaId" value={cuentaId} />
        <input type="hidden" name="moneda" value="USDT" />
        <fieldset className="grid gap-1">
          <legend className="mb-2 text-[15px] font-normal text-blanco">Elige la licencia</legend>
          {planes.map((plan) => (
            <label
              key={plan.codigo}
              className="opcion-plan grid cursor-pointer grid-cols-[20px_1fr_auto] items-center gap-3.5 py-3 text-ceniza transition-colors duration-200"
            >
              <input
                type="radio"
                name="plan"
                value={plan.codigo}
                defaultChecked={plan.codigo === 'SEMESTRAL'}
              />
              <span className="text-[15px]">
                {plan.nombre}
                <small className="block text-[13px] text-ceniza">{plan.detalle}</small>
              </span>
              <strong className="cifra text-[32px] font-normal tracking-[-0.04em]">
                {plan.precio}
              </strong>
            </label>
          ))}
        </fieldset>
        <p className="text-sm text-ceniza">
          La licencia empieza a contar el día que aprobamos tu pago. Pagas en USDT o BTC; lo eliges
          en el siguiente paso.
        </p>
      </CuerpoLateral>
      <PieLateral>
        <BotonEnviar enviando="Creando la orden…">Ir a pagar</BotonEnviar>
      </PieLateral>
    </form>
  );
}

/** Un enlace que crea una orden directa: "Renovar", "Pasar a semestral". */
export function BotonOrden({
  cuentaId,
  plan,
  variante = 'enlace',
  children,
}: {
  cuentaId: string;
  plan: string;
  /** `pildora` solo en el titular de la vista: hay una sola píldora por vista. */
  variante?: 'enlace' | 'pildora';
  children: string;
}) {
  const [estado, accion] = useActionState(crearOrden, {} as EstadoPanel);
  return (
    <form action={accion} className="contents">
      <input type="hidden" name="cuentaId" value={cuentaId} />
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="moneda" value="USDT" />
      <BotonEnviar variante={variante} enviando="Creando la orden…">
        {children}
      </BotonEnviar>
      {estado.mensaje ? (
        <p role="alert" className="basis-full text-sm text-error">
          {estado.mensaje}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Elegir con qué se paga: un grupo de opciones (flechas del teclado para moverse). Cambiar de moneda crea una orden
 * nueva con el monto en esa moneda; la anterior se cancela sola.
 */
export function SelectorRed({
  cuentaId,
  plan,
  actual,
}: {
  cuentaId: string;
  plan: string;
  actual: 'USDT' | 'BTC';
}) {
  const [estado, accion] = useActionState(crearOrden, {} as EstadoPanel);
  const formulario = useRef<HTMLFormElement>(null);
  const moneda = useRef<HTMLInputElement>(null);
  const opciones = [
    { moneda: 'USDT' as const, red: 'Tron (TRC20)' },
    { moneda: 'BTC' as const, red: 'Bitcoin' },
  ];
  const elegir = (nueva: 'USDT' | 'BTC') => {
    if (nueva === actual || !moneda.current) return;
    moneda.current.value = nueva;
    formulario.current?.requestSubmit();
  };
  const teclas = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const paso = ['ArrowRight', 'ArrowDown'].includes(evento.key)
      ? 1
      : ['ArrowLeft', 'ArrowUp'].includes(evento.key)
        ? -1
        : 0;
    if (!paso) return;
    evento.preventDefault();
    const siguiente = opciones[(indice + paso + opciones.length) % opciones.length]!;
    elegir(siguiente.moneda);
  };
  return (
    <form ref={formulario} action={accion} className="grid justify-items-start gap-3.5">
      <p id="t-redes" className="text-sm text-ceniza">
        Elige con qué pagas
      </p>
      <input type="hidden" name="cuentaId" value={cuentaId} />
      <input type="hidden" name="plan" value={plan} />
      <input ref={moneda} type="hidden" name="moneda" defaultValue={actual} />
      <Opciones opciones={opciones} actual={actual} elegir={elegir} teclas={teclas} />
      {estado.mensaje ? (
        <p role="alert" className="text-sm text-error">
          {estado.mensaje}
        </p>
      ) : null}
    </form>
  );
}

function Opciones({
  opciones,
  actual,
  elegir,
  teclas,
}: {
  opciones: { moneda: 'USDT' | 'BTC'; red: string }[];
  actual: string;
  elegir: (moneda: 'USDT' | 'BTC') => void;
  teclas: (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <div
      role="radiogroup"
      aria-labelledby="t-redes"
      aria-busy={pending}
      className="flex flex-wrap gap-2"
    >
      {opciones.map((opcion, i) => {
        const elegida = opcion.moneda === actual;
        return (
          <button
            key={opcion.moneda}
            type="button"
            role="radio"
            aria-checked={elegida}
            tabIndex={elegida ? 0 : -1}
            disabled={pending}
            onClick={() => elegir(opcion.moneda)}
            onKeyDown={(evento) => teclas(evento, i)}
            className={cx(
              'grid min-h-[52px] gap-0.5 rounded-pildora px-5 py-[9px] text-left text-[15px] leading-[1.2] font-medium transition-colors duration-200 disabled:opacity-60',
              elegida
                ? 'bg-blanco text-vacio'
                : 'bg-campo text-niebla hover:bg-campo-foco hover:text-blanco',
            )}
          >
            {opcion.moneda}
            <small className="text-xs font-light opacity-80">{opcion.red}</small>
          </button>
        );
      })}
      {pending ? (
        <span className="self-center text-sm text-ceniza">Calculando el monto…</span>
      ) : null}
    </div>
  );
}

/** Reportar el código de la transacción. Es la única píldora de la vista de Pagos. */
export function ReportarPago({ numero }: { numero: string }) {
  const [estado, accion] = useActionState(reportarPago, {} as EstadoPanel);
  const anterior = useRef(estado.listo);
  useEffect(() => {
    if (estado.listo && estado.listo !== anterior.current) {
      anterior.current = estado.listo;
      if (estado.aviso) avisar(estado.aviso);
    }
  }, [estado.listo, estado.aviso]);
  return (
    <form action={accion} noValidate className="grid w-full gap-3">
      <input type="hidden" name="numero" value={numero} />
      {estado.mensaje && !estado.campos ? <Aviso>{estado.mensaje}</Aviso> : null}
      <Campo
        etiqueta="Código de la transacción (hash)"
        name="hash"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="Ej.: 7f3a9c…e21b"
        maxLength={200}
        ayuda="Lo encuentras en tu billetera o exchange, en el detalle del envío."
        defaultValue={estado.valores?.hash}
        error={estado.campos?.hash}
      />
      <BotonEnviar enviando="Reportando…" className="justify-self-start">
        Reportar pago
      </BotonEnviar>
    </form>
  );
}

/** "Cancelar esta orden": vuelve a Mis cuentas. */
export function CancelarOrden({ numero }: { numero: string }) {
  const [estado, accion] = useActionState(cancelarOrden, {} as EstadoPanel);
  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="numero" value={numero} />
      <BotonEnviar
        variante="enlace"
        enviando="Cancelando…"
        className="text-ceniza hover:text-blanco"
      >
        Cancelar esta orden
      </BotonEnviar>
      {estado.mensaje ? (
        <p role="alert" className="text-sm text-error">
          {estado.mensaje}
        </p>
      ) : null}
    </form>
  );
}
