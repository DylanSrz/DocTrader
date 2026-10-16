import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CodigoQr } from '@/components/panel/codigo-qr';
import { Copiar } from '@/components/panel/copiar';
import { CancelarOrden, ReportarPago, SelectorRed } from '@/components/panel/ordenes';
import { Refrescar } from '@/components/panel/refrescar';
import { Regresiva } from '@/components/panel/regresiva';
import { Enlace, Estado } from '@/components/ui';
import {
  conceptoOrden,
  describirPlan,
  ESTADO_ORDEN_VISIBLE,
  fechaCorta,
  fechaLarga,
  montoCripto,
  nombreRed,
  usd,
} from '@/lib/formato';
import { leerPanel, type OrdenVista } from '@/lib/panel';
import { requerirSesion } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Pagos' };

const abierta = (o: OrdenVista) => o.estado === 'PENDIENTE' || o.estado === 'REPORTADA';

function Resumen({ orden }: { orden: OrdenVista }) {
  const meses = orden.plan.meses ? orden.plan.meses + orden.plan.mesesObsequio : null;
  const vence = orden.vencimientoSiSeAprueba
    ? fechaLarga(orden.vencimientoSiSeAprueba)
    : meses
      ? `${meses === 1 ? 'Un mes' : `${meses} meses`} desde que aprobemos el pago`
      : '—';
  const filas = [
    { dt: 'Orden', dd: orden.numero, cifra: true },
    { dt: 'Licencia', dd: describirPlan(orden.plan) },
    { dt: 'Cuenta de trading', dd: orden.cuenta.numero, cifra: true },
    { dt: orden.tipo === 'NUEVA' ? 'Vencimiento' : 'Nuevo vencimiento', dd: vence },
    { dt: 'Total', dd: usd(orden.montoUsdCentavos), cifra: true },
  ];
  return (
    <dl className="mt-10 grid gap-3.5 text-[15px]">
      {filas.map((f) => (
        <div key={f.dt} className="grid grid-cols-[9.5em_1fr] gap-3">
          <dt className="text-ceniza">{f.dt}</dt>
          <dd className={f.cifra ? 'cifra' : undefined}>{f.dd}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Lo que hay que enviar y a dónde: moneda, monto exacto, dirección y el reporte del hash. */
function Pago({ orden }: { orden: OrdenVista }) {
  return (
    <div className="grid gap-10">
      <SelectorRed cuentaId={orden.cuenta.id} plan={orden.plan.codigo} actual={orden.moneda} />

      <div className="grid justify-items-start gap-3.5">
        <p className="text-sm text-ceniza">Envía exactamente</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p
            id="monto"
            className="cifra text-[clamp(40px,4.6vw,64px)] leading-none tracking-[-0.04em]"
          >
            {montoCripto(orden.monto, orden.moneda)}
          </p>
          <Copiar texto={orden.monto} idTexto="monto" que="Monto" />
        </div>
        <p className="text-sm text-ceniza">
          {orden.precioBtcUsd
            ? `Precio fijo: ${usd(Math.round(Number(orden.precioBtcUsd)) * 100)} por BTC mientras la orden esté vigente. `
            : ''}
          Los centavos identifican tu pago: no lo redondees. Las comisiones de la red van aparte:
          debe llegar exactamente este monto.
        </p>
      </div>

      <div className="grid w-full justify-items-start gap-3.5">
        <p id="t-direccion" className="text-sm text-ceniza">
          A esta dirección
        </p>
        <div className="flex w-full items-center gap-x-4 gap-y-2 rounded-pildora bg-campo py-1.5 pr-1.5 pl-5">
          <code
            id="direccion"
            aria-labelledby="t-direccion"
            className="min-w-0 flex-1 py-2 font-sans text-[15px] font-normal break-all select-all"
          >
            {orden.direccion}
          </code>
          <Copiar texto={orden.direccion} idTexto="direccion" que="Dirección" />
        </div>
        <p className="text-[15px] text-niebla">
          <strong className="font-medium text-llama">
            Usa solo la red {nombreRed(orden.red)}.
          </strong>{' '}
          Si envías por otra red, el pago se pierde y no lo podemos recuperar.
        </p>
        <figure className="mt-2 flex items-center gap-5">
          <CodigoQr
            texto={orden.direccion}
            etiqueta={`Código QR de la dirección de depósito en ${nombreRed(orden.red)}`}
          />
          <figcaption className="max-w-[16em] text-sm text-ceniza">
            ¿Pagas desde otro celular? Escanea este código con tu billetera o con Binance. Lleva
            solo la dirección: el monto lo escribes tú.
          </figcaption>
        </figure>
      </div>

      <ReportarPago numero={orden.numero} />
      <CancelarOrden numero={orden.numero} />
    </div>
  );
}

/** Después de reportar: el hash, las confirmaciones (triángulos) y los chequeos que faltan. */
function Verificacion({ orden }: { orden: OrdenVista }) {
  const necesarias = orden.confirmacionesNecesarias;
  const llegadas = Math.min(orden.confirmaciones ?? 0, necesarias);
  const celda = 14;
  const pasos = [
    { texto: 'Pago reportado', ok: true },
    {
      texto: 'Transacción encontrada',
      ok:
        orden.verificacion !== null &&
        orden.verificacion !== 'SIN_VERIFICAR' &&
        orden.verificacion !== 'ERROR_PROVEEDOR',
    },
    {
      texto: 'Llegó a la dirección de esta orden con el monto correcto',
      ok: orden.verificacion === 'ESPERANDO_CONFIRMACIONES' || orden.verificacion === 'VERIFICADA',
    },
    { texto: 'Tiene las confirmaciones necesarias', ok: orden.verificacion === 'VERIFICADA' },
  ];
  return (
    <div className="grid gap-[18px]">
      <p role="status" className="text-xl tracking-[-0.01em]">
        Buscamos tu transacción en la blockchain. Un administrador aprobará el pago y te avisaremos
        por correo.
      </p>
      <div className="flex flex-wrap items-center gap-3.5">
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${necesarias * celda} 12`}
          className="h-3.5 w-auto max-w-full overflow-visible"
          style={{ width: necesarias * celda }}
        >
          {Array.from({ length: necesarias }, (_, i) => (
            <path
              key={i}
              d={`M${i * celda + 6} 1L${i * celda + 11} 11H${i * celda + 1}Z`}
              fill={i < llegadas ? 'var(--color-senal)' : 'none'}
              stroke={i < llegadas ? 'var(--color-senal)' : 'var(--color-ceniza)'}
              strokeWidth={1}
            />
          ))}
        </svg>
        <span className="cifra text-sm text-ceniza">
          {llegadas} de {necesarias} confirmaciones
        </span>
      </div>
      <ol className="grid gap-2 text-[15px] text-ceniza">
        {pasos.map((paso) => (
          <li
            key={paso.texto}
            className={`flex items-center gap-3 ${paso.ok ? 'text-blanco' : ''}`}
          >
            <svg viewBox="0 0 9 8" aria-hidden="true" className="h-2 w-[9px] shrink-0">
              <path
                d="M4.5 .9 8.2 7.5H.8Z"
                fill={paso.ok ? 'var(--color-senal)' : 'none'}
                stroke={paso.ok ? 'var(--color-senal)' : 'var(--color-ceniza)'}
              />
            </svg>
            {paso.texto}
            <span className="sr-only">{paso.ok ? ': hecho' : ': pendiente'}</span>
          </li>
        ))}
      </ol>
      {orden.hash ? (
        <p className="grid gap-1 text-sm text-ceniza">
          Código reportado
          <span className="cifra font-normal break-all text-niebla">{orden.hash}</span>
          {orden.enlaceExplorador ? (
            <Enlace href={orden.enlaceExplorador} target="_blank" rel="noopener" gris>
              Ver en el explorador
            </Enlace>
          ) : null}
        </p>
      ) : null}
      <Refrescar segundos={30} />
    </div>
  );
}

function Historial({ ordenes }: { ordenes: OrdenVista[] }) {
  return (
    <section aria-labelledby="t-historial" className="mt-[clamp(96px,12vw,168px)]">
      <h2 id="t-historial" className="mb-[clamp(40px,5vw,64px)] text-medio">
        Historial de pagos
      </h2>
      {ordenes.length === 0 ? (
        <p className="text-niebla">Todavía no tienes pagos.</p>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="t-historial"
          className="relative -mx-2 overflow-x-auto px-2"
        >
          <table className="w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-ceniza">
                <th scope="col" className="pr-4 pb-3.5 font-normal">
                  Fecha
                </th>
                <th scope="col" className="pr-4 pb-3.5 font-normal">
                  Concepto
                </th>
                <th scope="col" className="pr-4 pb-3.5 font-normal">
                  Pagado con
                </th>
                <th scope="col" className="pr-4 pb-3.5 text-right font-normal">
                  Monto
                </th>
                <th scope="col" className="pr-4 pb-3.5 font-normal">
                  Estado
                </th>
                <th scope="col" className="pb-3.5 font-normal">
                  <span className="sr-only">Comprobante</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((o) => {
                const estado = ESTADO_ORDEN_VISIBLE[o.estado];
                return (
                  <tr key={o.numero} className="align-top">
                    <td className="py-[18px] pr-4 whitespace-nowrap">
                      {fechaCorta(o.creadaEn)}
                      <small className="block text-[13px] text-ceniza">{o.numero}</small>
                    </td>
                    <td className="py-[18px] pr-4">
                      {conceptoOrden(o.tipo, o.plan.nombre)}
                      <small className="block text-[13px] text-ceniza">
                        Cuenta {o.cuenta.numero}
                      </small>
                    </td>
                    <td className="py-[18px] pr-4">
                      {o.moneda}
                      <small className="block text-[13px] text-ceniza">{nombreRed(o.red)}</small>
                    </td>
                    <td className="cifra py-[18px] pr-4 text-right">
                      {montoCripto(o.monto, o.moneda)}
                      <small className="block text-[13px] text-ceniza">
                        {usd(o.montoUsdCentavos)}
                      </small>
                    </td>
                    <td className="py-[18px] pr-4">
                      <Estado tono={estado.tono}>{estado.texto}</Estado>
                    </td>
                    <td className="py-[18px]">
                      {o.enlaceExplorador ? (
                        <Enlace href={o.enlaceExplorador} target="_blank" rel="noopener" gris>
                          Ver en el explorador
                        </Enlace>
                      ) : o.estado === 'PENDIENTE' ? (
                        <Enlace href={`/panel/pagos?orden=${o.numero}`} gris>
                          Pagar
                        </Enlace>
                      ) : o.estado === 'EXPIRADA' ? (
                        <small className="text-[13px] text-ceniza">
                          No se pagó dentro de la hora
                        </small>
                      ) : o.motivoRechazo ? (
                        <small className="text-[13px] text-ceniza">{o.motivoRechazo}</small>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function Contenido({ buscada }: { buscada: Promise<string | undefined> }) {
  await requerirSesion('CLIENT');
  const [ordenes, numero] = await Promise.all([leerPanel<OrdenVista[]>('/ordenes'), buscada]);
  const abiertas = ordenes.filter(abierta);
  const orden = (numero && ordenes.find((o) => o.numero === numero)) || abiertas[0];
  const otras = abiertas.filter((o) => o.numero !== orden?.numero);

  if (!orden) {
    return (
      <>
        <div className="grid max-w-[980px] justify-items-start gap-[26px]">
          <h1 className="text-grande">No tienes pagos pendientes.</h1>
          <p className="max-w-[36em] text-blanco">
            Para comprar o renovar una licencia, ve a tus cuentas y elige el plan.
          </p>
          <Enlace href="/panel">Ir a mis cuentas</Enlace>
        </div>
        <Historial ordenes={ordenes} />
      </>
    );
  }

  const estado = ESTADO_ORDEN_VISIBLE[orden.estado];
  const titulo =
    orden.estado === 'PENDIENTE'
      ? 'Envía el pago dentro de la hora.'
      : orden.estado === 'REPORTADA'
        ? 'Recibimos tu reporte.'
        : orden.estado === 'APROBADA'
          ? 'Pago aprobado.'
          : `Orden ${estado.texto.toLowerCase()}.`;
  const texto =
    orden.estado === 'PENDIENTE'
      ? 'Verificamos cada pago en la blockchain antes de activar la licencia.'
      : orden.estado === 'REPORTADA'
        ? 'Lo verificamos en la blockchain y un administrador lo aprueba. Puedes cerrar esta página: te avisamos por correo.'
        : orden.estado === 'RECHAZADA'
          ? (orden.motivoRechazo ?? 'Escríbenos a soporte si tienes dudas.')
          : orden.estado === 'APROBADA'
            ? 'Tu licencia ya está activa.'
            : 'Esta orden ya no se puede pagar. Si quieres pagar la licencia, crea una orden nueva desde tus cuentas.';

  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <h1 className="text-grande">{titulo}</h1>
        <p className="max-w-[36em] text-blanco">{texto}</p>
        {otras.length > 0 ? (
          <p className="text-[15px] text-niebla">
            También tienes abierta{otras.length > 1 ? 's' : ''}{' '}
            {otras.map((o, i) => (
              <span key={o.numero}>
                {i > 0 ? ', ' : ''}
                <Enlace href={`/panel/pagos?orden=${o.numero}`} className="text-[15px]">
                  {`la orden ${o.numero} (cuenta ${o.cuenta.numero})`}
                </Enlace>
              </span>
            ))}
            .
          </p>
        ) : null}
      </div>

      <section
        aria-label={`Orden ${orden.numero}`}
        className="mt-[clamp(64px,8vw,104px)] grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-16 max-md:grid-cols-1"
      >
        <div>
          {orden.estado === 'PENDIENTE' ? (
            <Regresiva expiraEn={orden.expiraEn} />
          ) : (
            <Estado tono={estado.tono}>{estado.texto}</Estado>
          )}
          <Resumen orden={orden} />
        </div>
        {orden.estado === 'PENDIENTE' ? <Pago orden={orden} /> : null}
        {orden.estado === 'REPORTADA' ? <Verificacion orden={orden} /> : null}
        {!abierta(orden) ? (
          <div className="grid justify-items-start gap-4">
            <Enlace href="/panel">Ir a mis cuentas</Enlace>
          </div>
        ) : null}
      </section>

      <Historial ordenes={ordenes} />
    </>
  );
}

export default function Pagos({ searchParams }: PageProps<'/panel/pagos'>) {
  const buscada = searchParams.then((p) => (typeof p.orden === 'string' ? p.orden : undefined));
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando tus pagos…</p>}>
      <Contenido buscada={buscada} />
    </Suspense>
  );
}
