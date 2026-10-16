import type { EstadoOrden, EstadoVerificacion, Moneda, Red, TipoOrden } from '@doctrader/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Refrescar } from '@/components/panel/refrescar';
import { Enlace, Estado, Etiqueta, Triangulo, cx } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { conceptoOrden, fechaCorta, montoCripto, nombreRed, usd } from '@/lib/formato';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import {
  AprobacionAutomatica,
  AprobarPago,
  RechazarPago,
  RegistrarPagoManual,
  VerificarPago,
} from './acciones-pago';

export const metadata: Metadata = { title: 'Pagos' };

interface Chequeo {
  clave: string;
  estado: 'OK' | 'FALLA' | 'ESPERA';
  texto: string;
}

interface PagoAdmin {
  numero: string;
  tipo: TipoOrden;
  estado: EstadoOrden;
  verificacion: EstadoVerificacion | null;
  cliente: { nombre: string; correo: string };
  cuenta: { numero: string; broker: string };
  plan: { codigo: string; nombre: string };
  moneda: Moneda;
  red: Red;
  monto: string;
  recibido: string | null;
  montoUsdCentavos: number;
  hash: string | null;
  enlaceExplorador: string | null;
  confirmaciones: number | null;
  confirmacionesNecesarias: number;
  chequeos: Chequeo[];
  nota: string | null;
  error: string | null;
  revisadaEn: string | null;
  creadaEn: string;
  expiraEn: string;
  reportadaEn: string | null;
  decididaEn: string | null;
  modo: 'MANUAL' | 'AUTO' | null;
  motivoRechazo: string | null;
}

interface Pagos {
  aprobacionAutomatica: boolean;
  porRevisar: PagoAdmin[];
  expiradas: PagoAdmin[];
  decididas: PagoAdmin[];
}

const hora = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});
const cuando = (fecha: string) => hora.format(new Date(fecha)).replace('.', '');

const VERIFICACION: Record<
  EstadoVerificacion,
  { texto: string; tono: 'senal' | 'llama' | 'neutro' | 'apagado' | 'error' }
> = {
  VERIFICADA: { texto: 'Verificado', tono: 'senal' },
  ESPERANDO_CONFIRMACIONES: { texto: 'Esperando confirmaciones', tono: 'neutro' },
  SIN_VERIFICAR: { texto: 'Buscando la transacción', tono: 'neutro' },
  MONTO_INCOMPLETO: { texto: 'Monto incompleto', tono: 'error' },
  NO_COINCIDE: { texto: 'No coincide', tono: 'error' },
  ERROR_PROVEEDOR: { texto: 'Sin respuesta de la blockchain', tono: 'llama' },
};

/** Motivo sugerido al rechazar, según lo que encontró la verificación. */
const SUGERIDO: Partial<Record<EstadoVerificacion, string>> = {
  MONTO_INCOMPLETO: 'monto',
  NO_COINCIDE: 'red',
  SIN_VERIFICAR: 'hash',
};

function MarcaChequeo({ estado }: { estado: Chequeo['estado'] }) {
  if (estado === 'OK') return <Triangulo className="mt-[7px] text-senal" />;
  if (estado === 'FALLA') return <Triangulo invertido className="mt-[7px] text-error" />;
  return <Triangulo relleno={false} className="mt-[7px] text-ceniza" />;
}

function Pago({ pago }: { pago: PagoAdmin }) {
  const verificacion = VERIFICACION[pago.verificacion ?? 'SIN_VERIFICAR'];
  const verificada = pago.verificacion === 'VERIFICADA';
  const esperando = pago.verificacion === 'ESPERANDO_CONFIRMACIONES';
  const vencida = new Date(pago.expiraEn) <= new Date();
  return (
    <li className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-8 py-2 max-md:grid-cols-1">
      <div className="grid justify-items-start gap-4">
        <Estado tono={verificacion.tono}>{verificacion.texto}</Estado>
        <h2 className="text-[clamp(26px,2.6vw,34px)] leading-[1.15] tracking-[-0.03em]">
          {pago.cliente.nombre}
        </h2>
        <p className="-mt-2 text-[15px] text-ceniza">
          Cuenta <span className="cifra">{pago.cuenta.numero}</span>,{' '}
          <span translate="no">{pago.cuenta.broker}</span>
        </p>
        <dl className="mt-2 grid grid-cols-[auto_auto] justify-start gap-x-6 gap-y-1.5 text-[15px]">
          <dt className="text-ceniza">Orden</dt>
          <dd className="cifra">{pago.numero}</dd>
          <dt className="text-ceniza">Licencia</dt>
          <dd>{conceptoOrden(pago.tipo, pago.plan.nombre)}</dd>
          <dt className="text-ceniza">Creada</dt>
          <dd>
            {cuando(pago.creadaEn)}, {vencida ? 'venció' : 'vence'} {cuando(pago.expiraEn)}
          </dd>
          <dt className="text-ceniza">Debía enviar</dt>
          <dd className="cifra">
            {montoCripto(pago.monto, pago.moneda)}{' '}
            <span className="text-ceniza">({usd(pago.montoUsdCentavos)})</span>
          </dd>
        </dl>
      </div>

      <div className="grid justify-items-start gap-5">
        {pago.recibido !== null ? (
          <p className="grid gap-1">
            <strong className="cifra text-[clamp(32px,3.4vw,44px)] leading-none font-normal tracking-[-0.04em]">
              {montoCripto(pago.recibido, pago.moneda)}
            </strong>
            <span className="text-[15px] text-niebla">Recibido por {nombreRed(pago.red)}</span>
          </p>
        ) : null}
        {pago.hash ? (
          <p className="grid w-full gap-1 text-sm text-ceniza">
            Código reportado
            <code className="font-sans text-[15px] break-all text-niebla">{pago.hash}</code>
            {pago.enlaceExplorador ? (
              <Enlace href={pago.enlaceExplorador} target="_blank" rel="noopener" gris>
                Ver en el explorador
              </Enlace>
            ) : null}
          </p>
        ) : null}
        {pago.chequeos.length > 0 ? (
          <ul aria-label="Verificación" className="grid gap-2 text-[15px]">
            {pago.chequeos.map((c) => (
              <li
                key={c.clave}
                className={cx(
                  'flex items-start gap-3',
                  c.estado === 'OK'
                    ? 'text-blanco'
                    : c.estado === 'FALLA'
                      ? 'text-error'
                      : 'text-ceniza',
                )}
              >
                <MarcaChequeo estado={c.estado} />
                <span>
                  {c.texto}
                  <span className="sr-only">
                    {c.estado === 'OK'
                      ? ': bien'
                      : c.estado === 'FALLA'
                        ? ': falló'
                        : ': en espera'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {pago.nota ? <p className="max-w-[34em] text-[15px] text-niebla">{pago.nota}</p> : null}
        {pago.error && !pago.nota ? (
          <p className="max-w-[34em] text-sm text-ceniza">
            Los proveedores de la blockchain no respondieron la última vez. Seguimos intentando.
          </p>
        ) : null}
        {pago.verificacion === 'MONTO_INCOMPLETO' ? (
          <p className="max-w-[34em] text-sm text-ceniza">
            Lo usual es pedirle al cliente que envíe lo que falta y luego aprobar de todos modos.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {verificada ? <AprobarPago numero={pago.numero} forzar={false} /> : null}
          {esperando ? (
            <p className="text-sm text-ceniza">
              Se aprueba al completar las confirmaciones ({pago.confirmaciones ?? 0} de{' '}
              {pago.confirmacionesNecesarias}).
            </p>
          ) : null}
          <RechazarPago
            numero={pago.numero}
            cliente={pago.cliente.nombre}
            sugerido={SUGERIDO[pago.verificacion ?? 'SIN_VERIFICAR'] ?? 'otro'}
          />
          {!verificada ? <VerificarPago numero={pago.numero} /> : null}
          {!verificada ? <AprobarPago numero={pago.numero} forzar /> : null}
        </div>
        {pago.revisadaEn ? (
          <p className="text-[13px] text-ceniza">
            Última revisión en la blockchain: {cuando(pago.revisadaEn)}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Tabla({
  titulo,
  id,
  pagos,
  ultima,
}: {
  titulo: string;
  id: string;
  pagos: PagoAdmin[];
  ultima: (p: PagoAdmin) => React.ReactNode;
}) {
  if (pagos.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mt-[clamp(96px,12vw,168px)]">
      <h2 id={id} className="mb-[clamp(32px,4vw,48px)] text-medio">
        {titulo}
      </h2>
      <div tabIndex={0} role="region" aria-labelledby={id} className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[760px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-ceniza">
              <th scope="col" className="pr-4 pb-3.5 font-normal">
                Creada
              </th>
              <th scope="col" className="pr-4 pb-3.5 font-normal">
                Cliente
              </th>
              <th scope="col" className="pr-4 pb-3.5 font-normal">
                Licencia
              </th>
              <th scope="col" className="pr-4 pb-3.5 text-right font-normal">
                Monto
              </th>
              <th scope="col" className="pb-3.5 font-normal">
                Qué pasó
              </th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.numero} className="align-top">
                <td className="py-4 pr-4 whitespace-nowrap">
                  {cuando(p.creadaEn)}
                  <small className="block text-[13px] text-ceniza">{p.numero}</small>
                </td>
                <td className="py-4 pr-4">
                  {p.cliente.nombre}
                  <small className="block text-[13px] text-ceniza">Cuenta {p.cuenta.numero}</small>
                </td>
                <td className="py-4 pr-4">{conceptoOrden(p.tipo, p.plan.nombre)}</td>
                <td className="cifra py-4 pr-4 text-right">
                  {montoCripto(p.monto, p.moneda)}
                  <small className="block text-[13px] text-ceniza">{usd(p.montoUsdCentavos)}</small>
                </td>
                <td className="py-4">{ultima(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function Contenido() {
  await requerirSesion('ADMIN');
  const token = await tokenDeSesion();
  const respuesta = await llamarApi<Pagos>('/admin/pagos', { token });
  if (!respuesta.ok) {
    return <p className="text-error">No pudimos cargar los pagos: {respuesta.error.mensaje}</p>;
  }
  const { porRevisar, expiradas, decididas, aprobacionAutomatica } = respuesta.datos;
  const n = porRevisar.length;
  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Pagos</Etiqueta>
        <h1 className="text-grande">
          {n === 0
            ? 'No hay pagos por revisar.'
            : n === 1
              ? '1 pago por revisar.'
              : `${n} pagos por revisar.`}
        </h1>
        <p className="max-w-[36em] text-blanco">
          Cada pago pasa por la verificación en la blockchain. Apruébalo para activar la licencia;
          la cuenta pasa sola a por conectar.
        </p>
        <AprobacionAutomatica activa={aprobacionAutomatica} />
      </div>

      {n > 0 ? (
        <section aria-label="Pagos por revisar" className="mt-[clamp(56px,7vw,96px)]">
          <ol className="grid gap-[clamp(72px,9vw,120px)]">
            {porRevisar.map((pago) => (
              <Pago key={pago.numero} pago={pago} />
            ))}
          </ol>
        </section>
      ) : (
        <p className="mt-10 max-w-[36em] text-niebla">
          Los nuevos aparecen aquí apenas el cliente reporta el código de la transacción.
        </p>
      )}

      <Tabla
        titulo="Revisados esta semana"
        id="t-decididos"
        pagos={decididas}
        ultima={(p) =>
          p.estado === 'APROBADA' ? (
            <span className="grid gap-1">
              <Estado tono="senal">{p.modo === 'AUTO' ? 'Aprobado solo' : 'Aprobado'}</Estado>
              {p.decididaEn ? (
                <small className="text-[13px] text-ceniza">{fechaCorta(p.decididaEn)}</small>
              ) : null}
            </span>
          ) : (
            <span className="grid gap-1">
              <Estado tono="error">Rechazado</Estado>
              {p.motivoRechazo ? (
                <small className="max-w-[28em] text-[13px] text-ceniza">{p.motivoRechazo}</small>
              ) : null}
            </span>
          )
        }
      />
      <Tabla
        titulo="Órdenes expiradas esta semana"
        id="t-expiradas"
        pagos={expiradas}
        ultima={(p) => (
          <span className="grid justify-items-start gap-1">
            <span className="text-niebla">No reportó un pago dentro de la hora</span>
            <RegistrarPagoManual numero={p.numero} cliente={p.cliente.nombre} />
          </span>
        )}
      />

      {/* Las verificaciones del worker van llegando: la vista se actualiza sola. */}
      <Refrescar segundos={30} />
    </>
  );
}

export default function PagosAdmin() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando los pagos…</p>}>
      <Contenido />
    </Suspense>
  );
}
