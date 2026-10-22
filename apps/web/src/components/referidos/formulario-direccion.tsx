'use client';

import { useActionState } from 'react';
import { type EstadoDireccion, guardarDireccion } from '@/app/acciones-referidos';
import { conAviso } from '@/components/admin/operacion';
import { BotonEnviar, Campo, CampoContrasena } from '@/components/ui';

const guardarConAviso = conAviso(guardarDireccion);

/** La dirección USDT (Tron) donde llegan las comisiones. Cambiarla pide confirmar la identidad. */
export function FormularioDireccion({
  actual,
  esperaHoras,
}: {
  actual: string | null;
  esperaHoras: number;
}) {
  const [estado, accion] = useActionState(guardarConAviso, {} as EstadoDireccion);
  const error = estado.error;
  return (
    <form action={accion} noValidate className="grid w-full max-w-[560px] gap-5">
      <Campo
        etiqueta="Dirección USDT (red Tron, TRC20)"
        name="direccion"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={64}
        translate="no"
        defaultValue={estado.valores?.direccion ?? actual ?? ''}
        ayuda={
          actual
            ? `Si la cambias, el próximo pago espera ${esperaHoras} horas y te avisamos por correo.`
            : 'Cópiala de tu billetera o de Binance (Depositar → USDT → red TRC20). Revisa que sea de la red Tron.'
        }
        error={estado.campos?.direccion}
      />
      {estado.pide === 'codigo' ? (
        <Campo
          etiqueta="Por seguridad, escribe el código de tu app"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          autoFocus
          required
          className="max-w-[22rem]"
        />
      ) : estado.pide === 'contrasena' ? (
        <CampoContrasena
          etiqueta="Por seguridad, escribe tu contraseña"
          name="contrasena"
          autoComplete="current-password"
          autoFocus
          required
          className="max-w-[22rem]"
        />
      ) : null}
      <div>
        <BotonEnviar enviando="Guardando…">
          {actual ? 'Cambiar dirección' : 'Guardar dirección'}
        </BotonEnviar>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
