'use client';

import { LIMITES_ADMIN } from '@doctrader/shared';
import { useActionState, useEffect, useRef, useState } from 'react';
import { CampoCodigo, conAviso, ErrorOperacion, useAlListo } from '@/components/admin/operacion';
import { BotonEnviar, Campo, descargarContenido, useEstadoAccion } from '@/components/ui';
import {
  type EstadoCedula,
  type EstadoExportacion,
  type EstadoOperacion,
  cambiarDatosCuenta,
  corregirReferidor,
  eliminarCliente,
  exportarLicencias,
  extenderLicencia,
  habilitarReferidor,
  reactivarLicencia,
  suspenderLicencia,
  verCedula,
} from '../acciones-operacion';

const suspenderLicenciaConAviso = conAviso(suspenderLicencia);
const reactivarLicenciaConAviso = conAviso(reactivarLicencia);
const extenderLicenciaConAviso = conAviso(extenderLicencia);
const eliminarClienteConAviso = conAviso(eliminarCliente);
const cambiarDatosCuentaConAviso = conAviso(cambiarDatosCuenta);
const habilitarReferidorConAviso = conAviso(habilitarReferidor);
const corregirReferidorConAviso = conAviso(corregirReferidor);
const clasesTexto =
  'w-full resize-y rounded-[20px] bg-campo px-5 py-3.5 text-base text-blanco placeholder:text-white/35 focus-visible:bg-campo-foco focus-visible:shadow-[0_0_0_2px_var(--color-senal)] focus-visible:outline-none';

/** La cédula enmascarada; "Ver completa" la pide a la API, que lo deja en la auditoría. */
export function Cedula({ cliente, final }: { cliente: string; final: string | null }) {
  const [estado, accion] = useActionState(verCedula, {} as EstadoCedula);
  if (!final) return <span className="text-ceniza">Sin cédula</span>;
  return (
    <form action={accion} className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1">
      <input type="hidden" name="cliente" value={cliente} />
      <span className="cifra text-blanco">{estado.cedula ?? `•••• ${final}`}</span>
      {estado.cedula ? null : (
        <BotonEnviar
          variante="enlace"
          enviando="Abriendo…"
          className="text-ceniza hover:text-blanco"
        >
          Ver completa
        </BotonEnviar>
      )}
      <ErrorOperacion estado={estado} />
    </form>
  );
}

/** Sumar días sin pago, con el motivo (queda en la ficha y en la auditoría; el cliente recibe un correo). */
export function Extender({ licencia }: { licencia: string }) {
  const [estado, accion] = useActionState(extenderLicenciaConAviso, {} as EstadoOperacion);
  const formulario = useRef<HTMLFormElement>(null);
  useAlListo(estado, () => formulario.current?.reset());
  const { diasExtension, motivo } = LIMITES_ADMIN;
  return (
    <form ref={formulario} action={accion} className="grid w-full justify-items-start gap-4">
      <input type="hidden" name="licencia" value={licencia} />
      <Campo
        etiqueta="Días"
        name="dias"
        inputMode="numeric"
        autoComplete="off"
        placeholder="7"
        required
        min={diasExtension.minimo}
        max={diasExtension.maximo}
        ayuda="Se suman al vencimiento actual; si ya terminó la gracia, desde hoy."
        error={estado.campos?.dias}
        className="max-w-[16rem]"
      />
      <div className="grid w-full gap-2">
        <label htmlFor={`motivo-ext-${licencia}`} className="text-[15px] text-blanco">
          Motivo
        </label>
        <textarea
          id={`motivo-ext-${licencia}`}
          name="motivo"
          rows={2}
          required
          minLength={motivo.minimo}
          maxLength={motivo.maximo}
          placeholder="Ej.: compensación por la falla del 14 de octubre"
          aria-invalid={estado.campos?.motivo ? true : undefined}
          className={clasesTexto}
        />
        {estado.campos?.motivo ? (
          <p className="text-sm text-error">{estado.campos.motivo}</p>
        ) : null}
      </div>
      <BotonEnviar variante="enlace" enviando="Sumando…">
        Sumar los días
      </BotonEnviar>
      {estado.error ? <ErrorOperacion estado={estado} /> : null}
    </form>
  );
}

/** Suspender pide un segundo clic de confirmación y un motivo. */
export function Suspender({ licencia }: { licencia: string }) {
  const [estado, accion] = useActionState(suspenderLicenciaConAviso, {} as EstadoOperacion);
  const [confirmando, setConfirmando] = useState(false);
  useAlListo(estado, () => setConfirmando(false));
  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-11 items-center text-sm text-error underline decoration-current/40 underline-offset-[6px] hover:decoration-current"
      >
        Suspender licencia
      </button>
    );
  }
  return (
    <form action={accion} className="grid w-full justify-items-start gap-4">
      <input type="hidden" name="licencia" value={licencia} />
      <div className="grid w-full gap-2">
        <label htmlFor={`motivo-sus-${licencia}`} className="text-[15px] text-blanco">
          Motivo de la suspensión (solo lo ven los admins)
        </label>
        <textarea
          id={`motivo-sus-${licencia}`}
          name="motivo"
          rows={2}
          required
          minLength={LIMITES_ADMIN.motivo.minimo}
          maxLength={LIMITES_ADMIN.motivo.maximo}
          autoFocus
          className={clasesTexto}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <BotonEnviar
          variante="enlace"
          enviando="Suspendiendo…"
          className="text-error decoration-current/40"
        >
          Sí, suspender
        </BotonEnviar>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco"
        >
          Cancelar
        </button>
      </div>
      <ErrorOperacion estado={estado} />
    </form>
  );
}

/**
 * Eliminar la cuenta del cliente que lo pidió. No se puede deshacer: pide un segundo clic, el motivo (queda en la
 * auditoría) y el código de la app.
 */
/** Broker, servidor y número: los cambia un admin cuando el cliente lo pide por ticket. Pide el código. */
export function CambiarDatosCuenta({
  cuenta,
  broker,
  servidor,
  numero,
}: {
  cuenta: string;
  broker: string;
  servidor: string;
  numero: string;
}) {
  const [estado, accion] = useActionState(cambiarDatosCuentaConAviso, {} as EstadoOperacion);
  const [abierto, setAbierto] = useState(false);
  useAlListo(estado, () => setAbierto(false));
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex min-h-11 items-center text-sm text-blanco underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
      >
        Cambiar broker, servidor o número
      </button>
    );
  }
  const v = estado.valores ?? {};
  return (
    <form action={accion} className="grid w-full justify-items-start gap-4">
      <input type="hidden" name="cuenta" value={cuenta} />
      <p className="text-sm text-ceniza">
        Solo cuando el cliente lo pide por ticket. Si la cuenta estaba conectada, queda por
        conectar: desconecta la anterior en Social Trader Tools.
      </p>
      <Campo
        etiqueta="Broker"
        name="broker"
        autoComplete="off"
        required
        defaultValue={v.broker ?? broker}
        error={estado.campos?.broker}
      />
      <Campo
        etiqueta="Servidor"
        name="servidor"
        autoComplete="off"
        required
        defaultValue={v.servidor ?? servidor}
        error={estado.campos?.servidor}
      />
      <Campo
        etiqueta="Número de cuenta"
        name="numero"
        inputMode="numeric"
        autoComplete="off"
        required
        defaultValue={v.numero ?? numero}
        error={estado.campos?.numero}
        className="max-w-[16rem]"
      />
      <div className="grid w-full gap-2">
        <label htmlFor={`motivo-cta-${cuenta}`} className="text-[15px] text-blanco">
          Motivo (por ejemplo, el número del ticket)
        </label>
        <textarea
          id={`motivo-cta-${cuenta}`}
          name="motivo"
          rows={2}
          required
          minLength={LIMITES_ADMIN.motivo.minimo}
          maxLength={LIMITES_ADMIN.motivo.maximo}
          defaultValue={v.motivo}
          aria-invalid={estado.campos?.motivo ? true : undefined}
          className={clasesTexto}
        />
        {estado.campos?.motivo ? (
          <p className="text-sm text-error">{estado.campos.motivo}</p>
        ) : null}
      </div>
      <CampoCodigo estado={estado} accion="cambiar los datos de la cuenta" />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <BotonEnviar variante="enlace" enviando="Guardando…">
          Guardar los datos nuevos
        </BotonEnviar>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco"
        >
          Cancelar
        </button>
      </div>
      <ErrorOperacion estado={estado} />
    </form>
  );
}

export function EliminarCliente({ cliente }: { cliente: string }) {
  const [estado, accion] = useActionState(eliminarClienteConAviso, {} as EstadoOperacion);
  const [confirmando, setConfirmando] = useState(false);
  useAlListo(estado, () => setConfirmando(false));
  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-11 items-center text-sm text-error underline decoration-current/40 underline-offset-[6px] hover:decoration-current"
      >
        Eliminar cliente
      </button>
    );
  }
  return (
    <form action={accion} className="grid w-full justify-items-start gap-4">
      <input type="hidden" name="cliente" value={cliente} />
      <div className="grid w-full gap-2">
        <label htmlFor={`motivo-eli-${cliente}`} className="text-[15px] text-blanco">
          Cómo lo pidió (por ejemplo, el número del ticket; sin datos personales)
        </label>
        <textarea
          id={`motivo-eli-${cliente}`}
          name="motivo"
          rows={2}
          required
          minLength={LIMITES_ADMIN.motivo.minimo}
          maxLength={LIMITES_ADMIN.motivo.maximo}
          defaultValue={estado.valores?.motivo}
          autoFocus
          className={clasesTexto}
        />
      </div>
      <CampoCodigo estado={estado} accion="eliminar al cliente" />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <BotonEnviar
          variante="enlace"
          enviando="Eliminando…"
          className="text-error decoration-current/40"
        >
          Sí, eliminar para siempre
        </BotonEnviar>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco"
        >
          Cancelar
        </button>
      </div>
      <ErrorOperacion estado={estado} />
    </form>
  );
}

export function Reactivar({ licencia }: { licencia: string }) {
  const [estado, accion] = useActionState(reactivarLicenciaConAviso, {} as EstadoOperacion);
  return (
    <form action={accion} className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <input type="hidden" name="licencia" value={licencia} />
      <BotonEnviar variante="enlace" enviando="Reactivando…">
        Quitar la suspensión
      </BotonEnviar>
      <ErrorOperacion estado={estado} />
    </form>
  );
}

/**
 * Exportar la lista a CSV (con el filtro y la búsqueda de la vista). Pide el código de la app si la confirmación ya
 * venció; el archivo se descarga en el navegador.
 */
export function Exportar({ filtro, q }: { filtro: string; q: string }) {
  const [estado, accion] = useActionState(exportarLicencias, {} as EstadoExportacion);
  const [descarga, setDescarga] = useEstadoAccion();
  useEffect(() => {
    if (!estado.csv || !estado.nombre) return;
    setDescarga(
      descargarContenido(estado.csv, estado.nombre, 'text/csv;charset=utf-8') ? 'exito' : 'error',
    );
    // setDescarga cambia en cada render; la descarga depende solo de un archivo nuevo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.csv, estado.nombre, estado.listo]);
  return (
    <form action={accion} className="grid justify-items-start gap-3">
      <input type="hidden" name="filtro" value={filtro} />
      <input type="hidden" name="q" value={q} />
      <CampoCodigo estado={estado} accion="exportar" />
      <BotonEnviar
        variante="enlace"
        enviando="Exportando…"
        className="text-ceniza hover:text-blanco"
      >
        Exportar CSV
      </BotonEnviar>
      <p aria-live="polite" className="text-sm">
        {descarga === 'exito' ? (
          <span className="text-senal">Listo: el archivo CSV se descargó.</span>
        ) : descarga === 'error' ? (
          <span className="text-error">No se pudo descargar el archivo. Intenta de nuevo.</span>
        ) : null}
      </p>
      <ErrorOperacion estado={estado} />
    </form>
  );
}

/** Habilitar a un cliente para referir aunque no tenga licencia activa, o quitarle la habilitación. */
export function HabilitarReferidor({
  cliente,
  habilitado,
}: {
  cliente: string;
  habilitado: boolean;
}) {
  const [estado, accion] = useActionState(habilitarReferidorConAviso, {} as EstadoOperacion);
  return (
    <form action={accion} noValidate className="grid justify-items-start gap-3">
      <input type="hidden" name="cliente" value={cliente} />
      <input type="hidden" name="habilitado" value={habilitado ? 'no' : 'si'} />
      <CampoCodigo
        estado={estado}
        accion={habilitado ? 'quitar la habilitación' : 'habilitarlo como referidor'}
      />
      <BotonEnviar variante="enlace" enviando="Guardando…">
        {habilitado ? 'Quitar la habilitación para referir' : 'Habilitar como referidor'}
      </BotonEnviar>
      <ErrorOperacion estado={estado} />
    </form>
  );
}

/** Corregir quién invitó al cliente (o quitarlo, con el código vacío). Solo cambia las ventas siguientes. */
export function CorregirReferidor({ cliente }: { cliente: string }) {
  const [estado, accion] = useActionState(corregirReferidorConAviso, {} as EstadoOperacion);
  const [abierto, setAbierto] = useState(false);
  useAlListo(estado, () => setAbierto(false));
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex min-h-11 items-center justify-self-start text-sm underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
      >
        Corregir quién lo invitó
      </button>
    );
  }
  return (
    <form action={accion} noValidate className="grid gap-4">
      <input type="hidden" name="cliente" value={cliente} />
      <Campo
        etiqueta="Código del referidor"
        name="codigoReferidor"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        defaultValue={estado.valores?.codigoReferidor}
        ayuda="Vacío para quitarlo. Las comisiones ya fijadas no cambian: anúlalas en Referidos si hace falta."
        error={estado.campos?.codigoReferidor}
      />
      <Campo
        etiqueta="Motivo"
        name="motivo"
        maxLength={500}
        required
        defaultValue={estado.valores?.motivo}
        error={estado.campos?.motivo}
      />
      <CampoCodigo estado={estado} accion="corregir el referidor" />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <BotonEnviar variante="enlace" enviando="Guardando…">
          Guardar
        </BotonEnviar>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="inline-flex min-h-11 items-center text-sm text-ceniza hover:text-blanco"
        >
          Cancelar
        </button>
      </div>
      <ErrorOperacion estado={estado} />
    </form>
  );
}
