'use client';

import { NIVEL_RIESGO, type NivelRiesgo } from '@doctrader/shared';
import { useActionState, useEffect, useState } from 'react';
import { CampoCodigo, conAviso, ErrorOperacion } from '@/components/admin/operacion';
import { Copiar } from '@/components/panel/copiar';
import { BotonEnviar, Campo, Selector } from '@/components/ui';
import { NOMBRE_RIESGO } from '@/lib/formato';
import {
  type EstadoContrasenas,
  type EstadoOperacion,
  guardarAsignacion,
  marcarConectada,
  marcarDesconectada,
  verContrasenas,
} from '../acciones-operacion';

const marcarDesconectadaConAviso = conAviso(marcarDesconectada);
const marcarConectadaConAviso = conAviso(marcarConectada);
const guardarAsignacionConAviso = conAviso(guardarAsignacion);
/**
 * Las dos contraseñas de la cuenta, ocultas hasta que el admin pulsa "Ver contraseñas" (con el segundo factor y en
 * la auditoría). Se ocultan solas a los 60 segundos (`docs/SEGURIDAD.md` §4.3).
 */
export function Contrasenas({ cuenta, borradas }: { cuenta: string; borradas: boolean }) {
  const [estado, accion] = useActionState(verContrasenas, {} as EstadoContrasenas);
  const [ahora, setAhora] = useState(() => Date.now());
  // El número de la vista que el admin ocultó a mano.
  const [ocultada, setOcultada] = useState<number | undefined>();
  const restantes = estado.hasta
    ? Math.min(60, Math.max(0, Math.ceil((estado.hasta - ahora) / 1000)))
    : 0;
  const visibles = Boolean(estado.contrasenas) && restantes > 0 && ocultada !== estado.listo;

  useEffect(() => {
    if (!estado.hasta) return;
    const reloj = setInterval(() => {
      setAhora(Date.now());
      if (Date.now() >= estado.hasta!) clearInterval(reloj);
    }, 1000);
    return () => clearInterval(reloj);
  }, [estado.hasta]);

  if (borradas) {
    return (
      <p className="text-[15px] text-niebla">
        Las contraseñas se borraron por el plazo de la política de datos. Pídele al cliente que las
        vuelva a escribir en su panel.
      </p>
    );
  }

  const fila = (etiqueta: string, valor: string | undefined, id: string) => (
    <>
      <dt className="text-ceniza">{etiqueta}</dt>
      <dd className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1">
        {visibles && valor ? (
          <>
            <code id={id} className="font-sans text-blanco [overflow-wrap:anywhere]">
              {valor}
            </code>
            <Copiar texto={valor} idTexto={id} que={etiqueta} />
          </>
        ) : (
          <span aria-label="Oculta" className="tracking-[0.2em] text-ceniza">
            ••••••••
          </span>
        )}
      </dd>
    </>
  );

  return (
    <form action={accion} className="grid w-full justify-items-start gap-4">
      <input type="hidden" name="cuenta" value={cuenta} />
      <dl className="grid w-full grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] items-center gap-x-6 text-[15px]">
        {fila('Contraseña operativa', estado.contrasenas?.operativa, `operativa-${cuenta}`)}
        {fila('Contraseña de inversor', estado.contrasenas?.inversor, `inversor-${cuenta}`)}
      </dl>
      <CampoCodigo estado={estado} accion="ver las contraseñas" />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {visibles ? (
          <button
            type="button"
            onClick={() => setOcultada(estado.listo)}
            className="inline-flex min-h-11 items-center text-sm text-blanco underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
          >
            Ocultar
          </button>
        ) : (
          <BotonEnviar variante="enlace" enviando="Abriendo…">
            Ver contraseñas
          </BotonEnviar>
        )}
        <span className="text-[13px] text-ceniza" aria-live="polite">
          {visibles
            ? `Se ocultan en ${restantes} s. Verlas queda en la auditoría.`
            : 'Verlas queda en la auditoría.'}
        </span>
      </div>
      <ErrorOperacion estado={estado} />
    </form>
  );
}

/** Capital recomendado y nivel de riesgo (los ve el cliente en su panel) y, en la ficha, las notas internas. */
export function Asignacion({
  cuenta,
  capitalUsdCentavos,
  riesgo,
  notas,
}: {
  cuenta: string;
  capitalUsdCentavos: number | null;
  riesgo: NivelRiesgo | null;
  /** Solo en la ficha: `undefined` no muestra el campo. */
  notas?: string | null;
}) {
  const [estado, accion] = useActionState(guardarAsignacionConAviso, {} as EstadoOperacion);
  return (
    <form action={accion} className="grid w-full max-w-[30rem] justify-items-start gap-3">
      <input type="hidden" name="cuenta" value={cuenta} />
      <div className="grid w-full grid-cols-2 gap-4 max-sm:grid-cols-1">
        <Campo
          etiqueta="Capital recomendado (USD)"
          name="capital"
          inputMode="decimal"
          autoComplete="off"
          placeholder="1.500"
          defaultValue={
            capitalUsdCentavos === null
              ? ''
              : (capitalUsdCentavos / 100).toLocaleString('es-CO', { maximumFractionDigits: 2 })
          }
          error={estado.campos?.capitalUsdCentavos}
        />
        <Selector
          etiqueta="Nivel de riesgo"
          name="riesgo"
          defaultValue={riesgo ?? ''}
          error={estado.campos?.riesgo}
        >
          <option value="">Sin asignar</option>
          {Object.values(NIVEL_RIESGO).map((n) => (
            <option key={n} value={n}>
              {NOMBRE_RIESGO[n]}
            </option>
          ))}
        </Selector>
      </div>
      {notas !== undefined ? (
        <div className="grid w-full gap-2">
          <label htmlFor={`notas-${cuenta}`} className="text-[15px] text-blanco">
            Notas internas
          </label>
          <textarea
            id={`notas-${cuenta}`}
            name="notas"
            rows={4}
            maxLength={2000}
            defaultValue={notas ?? ''}
            placeholder="Solo las ven los administradores"
            className="w-full resize-y rounded-[20px] bg-campo px-5 py-3.5 text-base text-blanco placeholder:text-white/35 focus-visible:bg-campo-foco focus-visible:shadow-[0_0_0_2px_var(--color-senal)] focus-visible:outline-none"
          />
        </div>
      ) : null}
      <BotonEnviar variante="enlace" enviando="Guardando…">
        {notas !== undefined ? 'Guardar capital, riesgo y notas' : 'Guardar capital y riesgo'}
      </BotonEnviar>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </form>
  );
}

/** "Marcar como conectada" (o desconectada): sale de la lista con un desvanecido corto. */
export function MarcarCuenta({
  cuenta,
  numero,
  tipo,
  principal,
}: {
  cuenta: string;
  numero: string;
  tipo: 'conectada' | 'desconectada';
  /** La primera de la lista lleva la píldora; las demás, el enlace (una sola píldora por vista). */
  principal: boolean;
}) {
  const [estado, accion] = useActionState(
    tipo === 'conectada' ? marcarConectadaConAviso : marcarDesconectadaConAviso,
    {} as EstadoOperacion,
  );
  return (
    <form action={accion} className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <input type="hidden" name="cuenta" value={cuenta} />
      <input type="hidden" name="numero" value={numero} />
      <BotonEnviar
        variante={principal ? 'pildora' : 'enlace'}
        enviando="Guardando…"
        className={principal ? undefined : 'text-[15px]'}
      >
        {tipo === 'conectada' ? 'Marcar como conectada' : 'Marcar como desconectada'}
      </BotonEnviar>
      <ErrorOperacion estado={estado} />
    </form>
  );
}
