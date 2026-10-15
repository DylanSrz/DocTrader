'use client';

import { LIMITES_ADMIN } from '@doctrader/shared';
import { useActionState, useEffect, useRef, useState } from 'react';
import { CampoCodigo, conAviso, ErrorOperacion, useAlListo } from '@/components/admin/operacion';
import { BotonEnviar, Campo } from '@/components/ui';
import {
  type EstadoCedula,
  type EstadoExportacion,
  type EstadoOperacion,
  eliminarCliente,
  exportarLicencias,
  extenderLicencia,
  reactivarLicencia,
  suspenderLicencia,
  verCedula,
} from '../acciones-operacion';

const suspenderLicenciaConAviso = conAviso(suspenderLicencia);
const reactivarLicenciaConAviso = conAviso(reactivarLicencia);
const extenderLicenciaConAviso = conAviso(extenderLicencia);
const eliminarClienteConAviso = conAviso(eliminarCliente);
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
  useEffect(() => {
    if (!estado.csv || !estado.nombre) return;
    const url = URL.createObjectURL(new Blob([estado.csv], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = estado.nombre;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      <ErrorOperacion estado={estado} />
    </form>
  );
}
