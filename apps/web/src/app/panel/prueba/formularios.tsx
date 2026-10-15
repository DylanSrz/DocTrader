'use client';

import { useActionState } from 'react';
import { Turnstile } from '@/components/turnstile';
import { Aviso, BotonEnviar, Campo } from '@/components/ui';
import { type EstadoPrueba, enviarCodigo, solicitarPrueba, verificarCodigo } from './acciones';

/**
 * Verificar el teléfono: primero se envía el código por SMS (con el desafío de Turnstile, porque cada SMS cuesta) y
 * luego se escribe. El código vale 10 minutos.
 */
export function VerificarTelefono({ telefono }: { telefono: string }) {
  const [envio, enviar] = useActionState(enviarCodigo, {} as EstadoPrueba);
  const [verificacion, verificar] = useActionState(verificarCodigo, {} as EstadoPrueba);
  return (
    <div className="grid w-full max-w-[30rem] justify-items-start gap-5">
      {envio.enviado ? (
        <form action={verificar} className="grid w-full justify-items-start gap-4">
          <Campo
            etiqueta={`Código que te enviamos al ${telefono}`}
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={8}
            autoFocus
            required
            error={verificacion.campos?.codigo}
            ayuda="Llega desde un número internacional. Vale 10 minutos."
          />
          {verificacion.error ? <Aviso>{verificacion.error}</Aviso> : null}
          <BotonEnviar enviando="Verificando…">Verificar el teléfono</BotonEnviar>
        </form>
      ) : null}
      <form action={enviar} className="grid justify-items-start gap-3">
        <Turnstile key={envio.envio} />
        {envio.error ? <Aviso>{envio.error}</Aviso> : null}
        <BotonEnviar
          variante={envio.enviado ? 'enlace' : 'pildora'}
          enviando="Enviando el SMS…"
          className={envio.enviado ? 'text-ceniza hover:text-blanco' : undefined}
        >
          {envio.enviado ? 'Enviar otro código' : 'Enviarme el código por SMS'}
        </BotonEnviar>
      </form>
    </div>
  );
}

/** Elegir la cuenta y pedir la prueba. Si se bloquea, se muestra qué coincidió. */
export function SolicitarPrueba({
  cuentas,
  habilitada,
}: {
  cuentas: { id: string; numero: string; broker: string; servidor: string }[];
  habilitada: boolean;
}) {
  const [estado, accion] = useActionState(solicitarPrueba, {} as EstadoPrueba);
  if (estado.motivos?.length) {
    return (
      <div role="alert" className="grid max-w-[34em] gap-3">
        <p className="text-blanco">No podemos darte la prueba:</p>
        <ul className="grid gap-1.5 text-niebla">
          {estado.motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <p className="text-[15px] text-ceniza">
          La prueba es una sola vez por persona y por cuenta de trading. Puedes comprar una licencia
          mensual o semestral desde tus cuentas.
        </p>
      </div>
    );
  }
  return (
    <form action={accion} className="grid w-full max-w-[34rem] justify-items-start gap-5">
      <fieldset className="grid w-full gap-1" disabled={!habilitada}>
        <legend className="mb-2 text-[15px] text-blanco">Cuenta de trading para la prueba</legend>
        {cuentas.map((c, i) => (
          <label
            key={c.id}
            className="opcion-plan grid cursor-pointer grid-cols-[20px_1fr] items-center gap-3.5 py-3 text-ceniza transition-colors duration-200"
          >
            <input type="radio" name="cuentaId" value={c.id} defaultChecked={i === 0} />
            <span className="text-[15px]">
              <span className="cifra">{c.numero}</span>
              <small className="block text-[13px] text-ceniza">
                <span translate="no">{c.broker}</span>, servidor {c.servidor}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      {estado.campos?.cuentaId ? (
        <p className="text-sm text-error">{estado.campos.cuentaId}</p>
      ) : null}
      {estado.error ? <Aviso>{estado.error}</Aviso> : null}
      <BotonEnviar enviando="Enviando la solicitud…" disabled={!habilitada}>
        Pedir la prueba
      </BotonEnviar>
    </form>
  );
}
