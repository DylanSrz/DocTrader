'use client';

import { MONEDA, NOMBRE_RED, RED_DE_MONEDA, type Moneda } from '@doctrader/shared';
import { useActionState, useRef, useState } from 'react';
import { CampoCodigo, conAviso, ErrorOperacion, useAlListo } from '@/components/admin/operacion';
import { BotonEnviar, Campo, Selector } from '@/components/ui';
import type { Ajustes } from '@/lib/admin';
import {
  agregarDireccion,
  cambiarDireccion,
  type EstadoOperacion,
  guardarEnlaces,
  guardarMyfxbook,
  guardarOperacion,
  guardarPrecios,
} from '../acciones-operacion';
import { guardarSoporte } from '../soporte/acciones';

const guardarPreciosConAviso = conAviso(guardarPrecios);
const guardarOperacionConAviso = conAviso(guardarOperacion);
const guardarMyfxbookConAviso = conAviso(guardarMyfxbook);
const guardarEnlacesConAviso = conAviso(guardarEnlaces);
const cambiarDireccionConAviso = conAviso(cambiarDireccion);
const agregarDireccionConAviso = conAviso(agregarDireccion);
const guardarSoporteConAviso = conAviso(guardarSoporte);
const dolares = (centavos: number) =>
  (centavos / 100).toLocaleString('es-CO', { maximumFractionDigits: 2 });

function Pie({
  estado,
  enviando,
  texto,
  delicado,
}: {
  estado: EstadoOperacion;
  enviando: string;
  texto: string;
  /** Pide el código de la app si la confirmación de los últimos 5 minutos ya venció. */
  delicado?: string;
}) {
  return (
    <div className="grid justify-items-start gap-4">
      {delicado ? <CampoCodigo estado={estado} accion={delicado} /> : null}
      <BotonEnviar variante="enlace" enviando={enviando}>
        {texto}
      </BotonEnviar>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </div>
  );
}

const rejilla = 'grid grid-cols-2 items-start gap-x-5 gap-y-6 max-sm:grid-cols-1';

export function Precios({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState(guardarPreciosConAviso, {} as EstadoOperacion);
  const precio = (codigo: string) =>
    ajustes.planes.find((p) => p.codigo === codigo)?.precioUsdCentavos ?? 0;
  const prueba = precio('PRUEBA');
  return (
    <form action={accion} className="grid gap-6" noValidate>
      <div className={rejilla}>
        {ajustes.planes
          .filter((p) => p.codigo !== 'PRUEBA')
          .map((p) => (
            <Campo
              key={p.codigo}
              etiqueta={`${p.nombre}, ${p.meses === 1 ? '1 mes' : `${p.meses} meses`} (USD)`}
              name={p.codigo}
              inputMode="decimal"
              defaultValue={dolares(p.precioUsdCentavos)}
              error={estado.campos?.[p.codigo]}
            />
          ))}
        <Campo
          etiqueta="Prueba (USD)"
          name="PRUEBA"
          inputMode="decimal"
          defaultValue={dolares(prueba)}
          error={estado.campos?.PRUEBA}
        />
        <Campo
          etiqueta="Duración de la prueba (días)"
          name="diasPrueba"
          inputMode="numeric"
          defaultValue={String(ajustes.diasPrueba)}
          error={estado.campos?.diasPrueba}
        />
      </div>
      <p className="text-sm text-ceniza">
        Para completar la prueba, el cliente paga la diferencia con el plan que elija; se calcula
        sola con estos precios. Hoy:{' '}
        {ajustes.planes
          .filter((p) => p.codigo !== 'PRUEBA')
          .map((p) => `${p.nombre.toLowerCase()} USD ${dolares(p.precioUsdCentavos - prueba)}`)
          .join(' y ')}
        .
      </p>
      <Pie
        estado={estado}
        enviando="Guardando…"
        texto="Guardar precios"
        delicado="cambiar precios"
      />
    </form>
  );
}

export function Operacion({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState(guardarOperacionConAviso, {} as EstadoOperacion);
  return (
    <form action={accion} className="grid gap-6" noValidate>
      <div className={rejilla}>
        <Campo
          etiqueta="Días de gracia"
          name="diasGracia"
          inputMode="numeric"
          defaultValue={String(ajustes.diasGracia)}
          ayuda="Después de vencer, la cuenta sigue conectada estos días. Aplica a los pagos que se aprueben desde ahora."
          error={estado.campos?.diasGracia}
        />
        <Campo
          etiqueta="Vigencia de la orden de pago (minutos)"
          name="minutosOrden"
          inputMode="numeric"
          defaultValue={String(ajustes.minutosOrden)}
          error={estado.campos?.minutosOrden}
        />
        <Campo
          etiqueta="Confirmaciones en Tron (USDT)"
          name="confirmacionesTron"
          inputMode="numeric"
          defaultValue={String(ajustes.confirmaciones.TRON)}
          error={estado.campos?.confirmacionesTron}
        />
        <Campo
          etiqueta="Confirmaciones en Bitcoin"
          name="confirmacionesBitcoin"
          inputMode="numeric"
          defaultValue={String(ajustes.confirmaciones.BITCOIN)}
          error={estado.campos?.confirmacionesBitcoin}
        />
      </div>
      <Pie estado={estado} enviando="Guardando…" texto="Guardar" delicado="cambiar estos ajustes" />
    </form>
  );
}

export function Enlaces({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState(guardarEnlacesConAviso, {} as EstadoOperacion);
  const e = ajustes.enlaces;
  return (
    <form action={accion} className="grid gap-6" noValidate>
      <Campo
        etiqueta="Soporte por Telegram"
        name="telegram"
        type="url"
        spellCheck={false}
        defaultValue={e?.telegram ?? ''}
        error={estado.campos?.telegram}
      />
      <Campo
        etiqueta="Instagram"
        name="instagram"
        type="url"
        spellCheck={false}
        defaultValue={e?.instagram ?? ''}
        error={estado.campos?.instagram}
      />
      <div className={rejilla}>
        <Campo
          etiqueta="Broker sugerido"
          name="brokerNombre"
          defaultValue={e?.broker.name ?? ''}
          error={estado.campos?.brokerNombre}
        />
        <Campo
          etiqueta="Enlace de referido del broker"
          name="brokerUrl"
          type="url"
          spellCheck={false}
          defaultValue={e?.broker.url ?? ''}
          error={estado.campos?.brokerUrl}
        />
      </div>
      <Campo
        etiqueta="Correo oficial de soporte"
        name="correoSoporte"
        type="email"
        spellCheck={false}
        defaultValue={ajustes.correoSoporte ?? ''}
        error={estado.campos?.correoSoporte}
      />
      <Pie estado={estado} enviando="Guardando…" texto="Guardar enlaces" />
    </form>
  );
}

export function Myfxbook({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState(guardarMyfxbookConAviso, {} as EstadoOperacion);
  const m = ajustes.myfxbook;
  return (
    <form action={accion} className="grid gap-6" noValidate>
      <Campo
        etiqueta="Cuenta en Myfxbook"
        name="url"
        type="url"
        spellCheck={false}
        defaultValue={m?.url ?? ''}
        error={estado.campos?.url}
      />
      <div className={rejilla}>
        <Campo
          etiqueta="Ganancia (%)"
          name="ganancia"
          inputMode="decimal"
          placeholder="246.68"
          defaultValue={m?.figures.gainPercent ?? ''}
          error={estado.campos?.ganancia}
        />
        <Campo
          etiqueta="Caída máxima (%)"
          name="caidaMaxima"
          inputMode="decimal"
          placeholder="Vacío: no se muestra"
          defaultValue={m?.figures.maxDrawdownPercent ?? ''}
          error={estado.campos?.caidaMaxima}
        />
        <Campo
          etiqueta="Auditada desde"
          name="auditadaDesde"
          type="date"
          defaultValue={m?.figures.auditedSince ?? ''}
          error={estado.campos?.auditadaDesde}
        />
        <Campo
          etiqueta="Cifras al"
          name="alDia"
          type="date"
          defaultValue={m?.figures.asOf ?? ''}
          error={estado.campos?.alDia}
        />
      </div>
      <p className="text-sm text-ceniza">
        La caída máxima y la fecha de auditoría solo se muestran cuando el historial esté completo.
        Un campo vacío no aparece en la página.
      </p>
      <Pie estado={estado} enviando="Guardando…" texto="Guardar cifras" />
    </form>
  );
}

const ESTADO_DIRECCION = {
  EN_ESPERA: 'En espera',
  ACTIVA: 'Activa',
  INACTIVA: 'Inactiva',
  CANCELADA: 'Cancelada',
} as const;

const fecha = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});

function AccionDireccion({
  id,
  accion,
  texto,
  delicada,
  peligro,
}: {
  id: string;
  accion: 'cancelar' | 'desactivar' | 'reactivar';
  texto: string;
  delicada?: string;
  peligro?: boolean;
}) {
  const [estado, enviar] = useActionState(cambiarDireccionConAviso, {} as EstadoOperacion);
  return (
    <form action={enviar} className="grid justify-items-start gap-3">
      <input type="hidden" name="direccion" value={id} />
      <input type="hidden" name="accion" value={accion} />
      {delicada ? <CampoCodigo estado={estado} accion={delicada} /> : null}
      <BotonEnviar
        variante="enlace"
        enviando="Guardando…"
        className={peligro ? 'text-error decoration-current/40' : 'text-ceniza hover:text-blanco'}
      >
        {texto}
      </BotonEnviar>
      <ErrorOperacion estado={estado} />
    </form>
  );
}

export function Direcciones({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState(agregarDireccionConAviso, {} as EstadoOperacion);
  const [abierto, setAbierto] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  useAlListo(estado, () => {
    formulario.current?.reset();
    setAbierto(false);
  });
  return (
    <div className="grid gap-8">
      <ul className="grid gap-7">
        {ajustes.direcciones.map((d) => (
          <li key={d.id} className="grid gap-1.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <b className="font-medium">
                {d.moneda} por {NOMBRE_RED[d.red]}
              </b>
              <span
                className={
                  d.estado === 'ACTIVA'
                    ? 'text-sm text-senal'
                    : d.estado === 'EN_ESPERA'
                      ? 'text-sm text-llama'
                      : 'text-sm text-ceniza'
                }
              >
                {ESTADO_DIRECCION[d.estado]}
                {d.enUso ? ', la usan las órdenes nuevas' : ''}
                {d.estado === 'EN_ESPERA'
                  ? `, se activa el ${fecha.format(new Date(d.activaDesde))}`
                  : ''}
              </span>
            </div>
            <code className="font-sans text-[15px] text-niebla [overflow-wrap:anywhere]">
              {d.direccion}
            </code>
            {d.creadaPor ? (
              <small className="text-[13px] text-ceniza">Agregada por {d.creadaPor}</small>
            ) : null}
            <div className="flex flex-wrap gap-x-6">
              {d.estado === 'EN_ESPERA' ? (
                <AccionDireccion
                  id={d.id}
                  accion="cancelar"
                  texto="Cancelar esta dirección"
                  peligro
                />
              ) : null}
              {d.estado === 'ACTIVA' ? (
                <AccionDireccion
                  id={d.id}
                  accion="desactivar"
                  texto="Desactivar"
                  delicada="desactivarla"
                />
              ) : null}
              {d.estado === 'INACTIVA' ? (
                <AccionDireccion
                  id={d.id}
                  accion="reactivar"
                  texto="Reactivar"
                  delicada="reactivarla"
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {abierto ? (
        <form ref={formulario} action={accion} className="grid gap-6" noValidate>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-5 max-sm:grid-cols-1">
            <Selector etiqueta="Moneda y red" name="moneda" defaultValue={MONEDA.USDT}>
              {Object.values(MONEDA).map((m: Moneda) => (
                <option key={m} value={m}>
                  {m} por {NOMBRE_RED[RED_DE_MONEDA[m]]}
                </option>
              ))}
            </Selector>
            <Campo
              etiqueta="Dirección"
              name="direccion"
              autoComplete="off"
              spellCheck={false}
              placeholder="Pega la dirección completa"
              error={estado.campos?.direccion}
            />
          </div>
          <p className="text-sm text-ceniza">
            Revisamos que sea de la red elegida. Queda en espera 24 horas y les avisamos a los dos
            admins con la dirección completa: cualquiera la puede cancelar en ese tiempo.
          </p>
          <div className="grid justify-items-start gap-4">
            <CampoCodigo estado={estado} accion="agregar la dirección" />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <BotonEnviar variante="enlace" enviando="Agregando…">
                Agregar esta dirección
              </BotonEnviar>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco"
              >
                Cancelar
              </button>
            </div>
            {estado.error ? <ErrorOperacion estado={estado} /> : null}
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex min-h-11 items-center justify-self-start text-sm text-blanco underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
        >
          Agregar dirección
        </button>
      )}
    </div>
  );
}

/** Cierre automático de los tickets resueltos. */
export function Soporte({ ajustes }: { ajustes: Ajustes }) {
  const [estado, accion] = useActionState(guardarSoporteConAviso, {} as EstadoOperacion);
  return (
    <form action={accion} className="grid gap-6" noValidate>
      <Campo
        etiqueta="Cerrar los tickets resueltos después de (días)"
        name="diasCierre"
        inputMode="numeric"
        defaultValue={String(ajustes.diasCierreTickets)}
        ayuda="Mientras tanto, el cliente puede escribir en el ticket y se abre de nuevo."
        error={estado.campos?.diasCierre}
        className="max-w-[26rem]"
      />
      <Pie estado={estado} enviando="Guardando…" texto="Guardar" />
    </form>
  );
}
