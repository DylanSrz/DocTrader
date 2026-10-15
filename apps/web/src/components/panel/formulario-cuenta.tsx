'use client';

import { useActionState, useEffect, useRef } from 'react';
import { agregarCuenta, editarCuenta, type EstadoPanel, quitarCuenta } from '@/app/panel/acciones';
import { Aviso, BotonEnviar, Campo, CampoContrasena } from '@/components/ui';
import { avisar } from './aviso-breve';
import { CuerpoLateral, PieLateral, useCerrarLateral } from './lateral';

export interface PlanOpcion {
  codigo: string;
  nombre: string;
  detalle: string;
  precio: string;
}

/** Cuando un envío termina bien: cierra el panel lateral y lo dice en un aviso breve. */
function useAlTerminar(estado: EstadoPanel) {
  const cerrar = useCerrarLateral();
  const anterior = useRef(estado.listo);
  useEffect(() => {
    if (estado.listo && estado.listo !== anterior.current) {
      anterior.current = estado.listo;
      cerrar();
      if (estado.aviso) avisar(estado.aviso);
    }
  }, [estado.listo, estado.aviso, cerrar]);
}

/** Lleva el foco al primer campo con error, para que el lector de pantalla y el teclado lleguen ahí. */
function useFocoEnError(formulario: React.RefObject<HTMLFormElement | null>, estado: EstadoPanel) {
  useEffect(() => {
    if (!estado.campos) return;
    formulario.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [estado, formulario]);
}

/**
 * Agregar o editar una cuenta de trading, en el panel lateral. Al agregar también se elige la licencia y se va
 * directo a pagar. Al editar, las contraseñas vacías se quedan como estaban.
 */
export function FormularioCuenta({
  cuenta,
  planes,
  titularSugerido,
  sePuedeQuitar = false,
}: {
  cuenta?: { id: string; titular: string; broker: string; servidor: string; numero: string };
  planes?: PlanOpcion[];
  titularSugerido?: string;
  sePuedeQuitar?: boolean;
}) {
  const editar = Boolean(cuenta);
  const [estado, accion] = useActionState(editar ? editarCuenta : agregarCuenta, {} as EstadoPanel);
  const [estadoQuitar, quitar, quitando] = useActionState(quitarCuenta, {} as EstadoPanel);
  const formulario = useRef<HTMLFormElement>(null);
  useAlTerminar(estado);
  useAlTerminar(estadoQuitar);
  useFocoEnError(formulario, estado);
  const v = estado.valores ?? {};
  const e = estado.campos ?? {};
  const valor = (campo: 'titular' | 'broker' | 'servidor' | 'numero') =>
    v[campo] ?? cuenta?.[campo] ?? (campo === 'titular' ? titularSugerido : undefined);

  return (
    <>
      <form
        ref={formulario}
        action={accion}
        noValidate
        className="grid min-h-0 grid-rows-[1fr_auto]"
      >
        <CuerpoLateral>
          <p className="text-sm text-niebla">
            Tus contraseñas se guardan cifradas. Solo el administrador las ve, para conectar tu
            cuenta.
          </p>
          {estado.mensaje ? <Aviso>{estado.mensaje}</Aviso> : null}
          {cuenta ? <input type="hidden" name="id" value={cuenta.id} /> : null}
          <Campo
            etiqueta="Nombre del titular de la cuenta"
            name="titular"
            autoComplete="name"
            required
            maxLength={120}
            defaultValue={valor('titular')}
            error={e.titular}
          />
          <Campo
            etiqueta="Broker"
            name="broker"
            list="brokers-sugeridos"
            autoComplete="off"
            spellCheck={false}
            placeholder="Ej.: JustMarkets"
            required
            maxLength={80}
            defaultValue={valor('broker')}
            error={e.broker}
          />
          <datalist id="brokers-sugeridos">
            <option value="JustMarkets" />
          </datalist>
          <Campo
            etiqueta="Servidor"
            name="servidor"
            autoComplete="off"
            spellCheck={false}
            placeholder="Ej.: JustMarkets-Live"
            required
            maxLength={80}
            ayuda="Aparece en el correo que te envió el broker al abrir la cuenta."
            defaultValue={valor('servidor')}
            error={e.servidor}
          />
          <Campo
            etiqueta="Número de cuenta"
            name="numero"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="Ej.: 50213847"
            required
            maxLength={16}
            defaultValue={valor('numero')}
            error={e.numero}
          />
          <CampoContrasena
            etiqueta="Contraseña operativa"
            name="contrasenaOperativa"
            autoComplete="off"
            required={!editar}
            maxLength={64}
            ayuda={editar ? 'Déjala vacía para no cambiarla.' : undefined}
            error={e.contrasenaOperativa}
          />
          <CampoContrasena
            etiqueta="Contraseña de inversor"
            name="contrasenaInversor"
            autoComplete="off"
            required={!editar}
            maxLength={64}
            ayuda={editar ? 'Déjala vacía para no cambiarla.' : 'La de solo lectura.'}
            error={e.contrasenaInversor}
          />
          {planes ? (
            <fieldset className="grid gap-1">
              <legend className="mb-2 text-[15px] font-normal text-blanco">
                Licencia para esta cuenta
              </legend>
              {planes.map((plan) => (
                <label
                  key={plan.codigo}
                  className="opcion-plan grid cursor-pointer grid-cols-[20px_1fr_auto] items-center gap-3.5 py-3 text-ceniza transition-colors duration-200"
                >
                  <input
                    type="radio"
                    name="plan"
                    value={plan.codigo}
                    defaultChecked={(v.plan ?? 'SEMESTRAL') === plan.codigo}
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
          ) : null}
          {editar ? (
            <p className="text-sm text-ceniza">
              Si la cuenta ya está conectada y cambias sus datos o contraseñas, la actualizaremos en
              el copy trading y te avisaremos por correo.
            </p>
          ) : null}
        </CuerpoLateral>
        <PieLateral>
          {estadoQuitar.mensaje ? (
            <p role="alert" className="basis-full text-sm text-error">
              {estadoQuitar.mensaje}
            </p>
          ) : null}
          {cuenta && sePuedeQuitar ? (
            <button
              type="submit"
              form={`quitar-${cuenta.id}`}
              disabled={quitando}
              className="mr-auto inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco hover:decoration-current disabled:opacity-50"
              onClick={(evento) => {
                if (
                  !window.confirm('¿Quitar esta cuenta de tu panel? Sus contraseñas se borran.')
                ) {
                  evento.preventDefault();
                }
              }}
            >
              {quitando ? 'Quitando…' : 'Quitar cuenta'}
            </button>
          ) : null}
          <BotonEnviar enviando="Guardando…">
            {editar ? 'Guardar cambios' : 'Guardar e ir a pagar'}
          </BotonEnviar>
        </PieLateral>
      </form>
      {/* "Quitar cuenta" es otro formulario: no se puede anidar, así que el botón lo envía con `form=`. */}
      {cuenta && sePuedeQuitar ? (
        <form id={`quitar-${cuenta.id}`} action={quitar} hidden>
          <input type="hidden" name="id" value={cuenta.id} />
        </form>
      ) : null}
    </>
  );
}
