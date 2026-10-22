import {
  DIAS_VENCE_PRONTO,
  FILTROS_LICENCIAS,
  type FiltroLicencias,
  formatearTelefono,
  NOMBRE_FILTRO_LICENCIAS,
  nombreDocumento,
  nombrePais,
} from '@doctrader/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LateralAbierto } from '@/components/panel/lateral';
import { Estado, Etiqueta, cx } from '@/components/ui';
import {
  ESTADO_LICENCIA_ADMIN,
  type Ficha,
  type ListaLicencias,
  NOMBRE_CONEXION,
} from '@/lib/admin';
import { llamarApi } from '@/lib/api';
import { conceptoOrden, ESTADO_ORDEN_VISIBLE, fechaCorta, fechaLarga, usd } from '@/lib/formato';
import type { FichaReferidos } from '@/lib/referidos';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import { Asignacion } from '../cuentas/acciones-cuenta';
import {
  Cedula,
  CambiarDatosCuenta,
  CorregirReferidor,
  EliminarCliente,
  Exportar,
  Extender,
  HabilitarReferidor,
  Reactivar,
  Suspender,
} from './acciones-licencia';

export const metadata: Metadata = { title: 'Licencias' };

type Parametros = Promise<{ filtro?: string; q?: string; ficha?: string }>;

function enlaceLista(filtro: FiltroLicencias, q: string, ficha?: string): string {
  const p = new URLSearchParams();
  if (filtro !== 'todas') p.set('filtro', filtro);
  if (q) p.set('q', q);
  if (ficha) p.set('ficha', ficha);
  const texto = p.toString();
  return texto ? `/admin/licencias?${texto}` : '/admin/licencias';
}

/** Estado que ve el admin: el de la licencia, matizado por la conexión ("Por desconectar", "Vence pronto"). */
function estadoVisible(l: ListaLicencias['licencias'][number]) {
  if (l.cuenta.conexion === 'POR_DESCONECTAR') {
    return { texto: 'Por desconectar', tono: 'error' as const };
  }
  if (l.estado === 'ACTIVA' && l.dias !== null && l.dias <= DIAS_VENCE_PRONTO) {
    return { texto: 'Vence pronto', tono: 'llama' as const };
  }
  if (l.estado === 'ACTIVA' && l.cuenta.conexion === 'POR_CONECTAR') {
    return { texto: 'Por conectar', tono: 'neutro' as const };
  }
  if (l.estado === 'ACTIVA' && l.cuenta.conexion === 'CONECTADA') {
    return { texto: 'Conectada', tono: 'senal' as const };
  }
  return ESTADO_LICENCIA_ADMIN[l.estado];
}

const NOMBRE_PERIODO: Record<Ficha['periodos'][number]['tipo'], string> = {
  NUEVA: 'Licencia',
  RENOVACION: 'Renovación',
  CAMBIO_DE_PLAN: 'Cambio a',
  EXTENSION_ADMIN: 'Días extendidos',
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <h3 className="text-[20px] tracking-[-0.02em]">{titulo}</h3>
      {children}
    </section>
  );
}

function ContenidoFicha({
  ficha,
  referidos,
  volver,
}: {
  ficha: Ficha;
  referidos: FichaReferidos | null;
  volver: (id: string) => string;
}) {
  const estado = ESTADO_LICENCIA_ADMIN[ficha.estado];
  const vigente = ['ACTIVA', 'EN_GRACIA'].includes(ficha.estado);
  const eliminado = ficha.cliente.estado === 'DELETED';
  return (
    <>
      <div className="grid justify-items-start gap-3">
        <Estado tono={estado.tono}>{estado.texto}</Estado>
        <p className="text-[15px] text-niebla">
          {ficha.plan ? `${ficha.plan}. ` : ''}
          {ficha.vence
            ? `Vence el ${fechaLarga(ficha.vence)}${
                ficha.finGracia ? `; la gracia termina el ${fechaLarga(ficha.finGracia)}` : ''
              }.`
            : 'Todavía no tiene un pago aprobado.'}
        </p>
        {ficha.suspension ? (
          <p className="text-[15px] text-error">
            Suspendida el {fechaLarga(ficha.suspension.fecha)}
            {ficha.suspension.motivo ? `: ${ficha.suspension.motivo}` : '.'}
          </p>
        ) : null}
      </div>

      {eliminado ? null : (
        <Seccion titulo="Contacto">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-6 gap-y-1 text-[15px]">
            <dt className="text-ceniza">
              {ficha.cliente.documentoPais && ficha.cliente.documentoTipo
                ? nombreDocumento(ficha.cliente.documentoPais, ficha.cliente.documentoTipo)
                : 'Documento'}
              {ficha.cliente.documentoPais && ficha.cliente.documentoPais !== 'CO' ? (
                <small className="block text-[13px]">
                  {nombrePais(ficha.cliente.documentoPais)}
                </small>
              ) : null}
            </dt>
            <dd>
              <Cedula cliente={ficha.cliente.id} final={ficha.cliente.cedulaFinal} />
            </dd>
            <dt className="text-ceniza">Correo</dt>
            <dd className="flex min-h-11 items-center [overflow-wrap:anywhere]">
              <a
                href={`mailto:${ficha.cliente.correo}`}
                className="underline decoration-white/35 underline-offset-4"
              >
                {ficha.cliente.correo}
              </a>
              {ficha.cliente.correoVerificado ? null : (
                <span className="ml-2 text-ceniza">(sin confirmar)</span>
              )}
            </dd>
            <dt className="text-ceniza">Teléfono</dt>
            <dd className="cifra flex min-h-11 items-center">
              {ficha.cliente.telefono ? formatearTelefono(ficha.cliente.telefono) : '—'}
            </dd>
          </dl>
        </Seccion>
      )}

      <Seccion titulo="Cuenta de trading">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-[15px]">
          <dt className="text-ceniza">Número</dt>
          <dd className="cifra">{ficha.cuenta.numero}</dd>
          <dt className="text-ceniza">Broker</dt>
          <dd translate="no">{ficha.cuenta.broker}</dd>
          <dt className="text-ceniza">Servidor</dt>
          <dd translate="no" className="[overflow-wrap:anywhere]">
            {ficha.cuenta.servidor}
          </dd>
          <dt className="text-ceniza">Titular</dt>
          <dd>{ficha.cuenta.titular}</dd>
          <dt className="text-ceniza">Conexión</dt>
          <dd>
            {NOMBRE_CONEXION[ficha.cuenta.conexion]}
            {ficha.cuenta.conectadaEn && ficha.cuenta.conexion === 'CONECTADA'
              ? ` desde el ${fechaCorta(ficha.cuenta.conectadaEn)}`
              : ''}
          </dd>
        </dl>
        {eliminado ? null : (
          <CambiarDatosCuenta
            key={`${ficha.cuenta.numero}-${ficha.cuenta.servidor}`}
            cuenta={ficha.cuenta.id}
            broker={ficha.cuenta.broker}
            servidor={ficha.cuenta.servidor}
            numero={ficha.cuenta.numero}
          />
        )}
      </Seccion>

      {eliminado ? null : (
        <Seccion titulo="Ajustar">
          <Asignacion
            cuenta={ficha.cuenta.id}
            capitalUsdCentavos={ficha.cuenta.capitalUsdCentavos}
            riesgo={ficha.cuenta.riesgo}
            notas={ficha.cuenta.notas}
          />
        </Seccion>
      )}

      {ficha.vence && !eliminado ? (
        <Seccion titulo="Extender días">
          <Extender licencia={ficha.id} />
        </Seccion>
      ) : null}

      {ficha.periodos.length > 0 ? (
        <Seccion titulo="Periodos">
          <ol className="grid gap-3 text-[15px]">
            {ficha.periodos.map((p) => (
              <li key={`${p.tipo}-${p.inicio}-${p.fin}`} className="grid gap-0.5">
                <span>
                  {p.tipo === 'EXTENSION_ADMIN'
                    ? NOMBRE_PERIODO[p.tipo]
                    : `${NOMBRE_PERIODO[p.tipo]} ${p.plan.toLowerCase()}`}
                  <span className="text-ceniza">
                    {' '}
                    · {fechaCorta(p.inicio)} al {fechaCorta(p.fin)}
                  </span>
                </span>
                <small className="text-[13px] text-ceniza">
                  {p.orden ? `Orden ${p.orden}` : null}
                  {p.nota ? `${p.creadoPor ? `${p.creadoPor}: ` : ''}${p.nota}` : null}
                </small>
              </li>
            ))}
          </ol>
        </Seccion>
      ) : null}

      {ficha.pagos.length > 0 ? (
        <Seccion titulo="Pagos">
          <ol className="grid gap-3 text-[15px]">
            {ficha.pagos.map((p) => (
              <li
                key={p.numero}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
              >
                <span>
                  {conceptoOrden(p.tipo, p.plan)}
                  <small className="block text-[13px] text-ceniza">
                    {p.numero} · {fechaCorta(p.creadaEn)} · {usd(p.montoUsdCentavos)} en {p.moneda}
                  </small>
                </span>
                <Estado tono={ESTADO_ORDEN_VISIBLE[p.estado].tono}>
                  {ESTADO_ORDEN_VISIBLE[p.estado].texto}
                </Estado>
              </li>
            ))}
          </ol>
        </Seccion>
      ) : null}

      {ficha.otrasCuentas.length > 0 ? (
        <Seccion titulo="Otras cuentas del cliente">
          <ul className="grid gap-1 text-[15px]">
            {ficha.otrasCuentas.map((o) => (
              <li key={o.licenciaId}>
                <Link
                  href={volver(o.licenciaId)}
                  scroll={false}
                  className="inline-flex min-h-11 items-center gap-3 underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
                >
                  <span className="cifra">{o.numero}</span>
                  <span className="text-ceniza">
                    {o.broker} · {ESTADO_LICENCIA_ADMIN[o.estado].texto}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}

      {referidos && !eliminado ? (
        <Seccion titulo="Referidos">
          <p className="text-[15px] text-niebla">
            {referidos.referidoPor ? (
              <>
                Lo invitó <span className="text-blanco">{referidos.referidoPor.nombre}</span> (
                {referidos.referidoPor.correo}
                {referidos.referidoPor.codigo ? (
                  <>
                    , código <span className="cifra">{referidos.referidoPor.codigo}</span>
                  </>
                ) : null}
                )
                {referidos.referidoPor.desde
                  ? ` el ${fechaCorta(referidos.referidoPor.desde)}`
                  : ''}
                .
              </>
            ) : (
              'Llegó sin invitación de un referidor.'
            )}
          </p>
          <CorregirReferidor cliente={ficha.cliente.id} />
          <p className="text-[15px] text-niebla">
            {referidos.perfil?.habilitado
              ? `Habilitado para referir aunque no tenga licencia activa${referidos.perfil.habilitadoEn ? `, desde el ${fechaCorta(referidos.perfil.habilitadoEn)}` : ''}.`
              : referidos.puedeReferir
                ? 'Puede referir porque tiene una licencia activa.'
                : 'No puede referir: no tiene una licencia activa.'}
            {referidos.perfil ? (
              <>
                {' '}
                Su código es <span className="cifra">{referidos.perfil.codigo}</span>
                {referidos.perfil.direccion ? '' : ' y todavía no registra dirección de cobro'}.
              </>
            ) : null}
          </p>
          <HabilitarReferidor
            cliente={ficha.cliente.id}
            habilitado={referidos.perfil?.habilitado === true}
          />
        </Seccion>
      ) : null}

      {vigente || ficha.estado === 'SUSPENDIDA' ? (
        <Seccion titulo={ficha.estado === 'SUSPENDIDA' ? 'Suspensión' : 'Suspender'}>
          {ficha.estado === 'SUSPENDIDA' ? (
            <>
              <p className="text-sm text-ceniza">
                Al quitarla, la licencia vuelve al estado de sus fechas y, si sigue vigente, la
                cuenta vuelve a la lista por conectar (o sigue conectada si no la habías
                desconectado).
              </p>
              <Reactivar licencia={ficha.id} />
            </>
          ) : (
            <>
              <p className="text-sm text-ceniza">
                La cuenta pasa a por desconectar aunque la licencia siga vigente, y los días siguen
                corriendo. Úsalo solo ante un problema con el cliente.
              </p>
              <Suspender licencia={ficha.id} />
            </>
          )}
        </Seccion>
      ) : null}

      {eliminado ? (
        <Seccion titulo="Cliente eliminado">
          <p className="text-sm text-ceniza">
            Sus datos personales se borraron a su pedido. Quedan sus órdenes y pagos, que exige la
            ley.
          </p>
        </Seccion>
      ) : (
        <Seccion titulo="Eliminar cliente">
          <p className="text-sm text-ceniza">
            Solo si el cliente lo pide. Se borran su nombre, cédula, correo, teléfono, las
            contraseñas de sus cuentas y sus tickets; sus licencias terminan y una cuenta conectada
            queda por desconectar. Se conservan sus órdenes y pagos. No se puede deshacer.
          </p>
          <EliminarCliente cliente={ficha.cliente.id} />
        </Seccion>
      )}
    </>
  );
}

async function Contenido({ parametros }: { parametros: Parametros }) {
  await requerirSesion('ADMIN');
  const { filtro: filtroCrudo, q: qCruda, ficha: idFicha } = await parametros;
  const filtro = FILTROS_LICENCIAS.includes(filtroCrudo as FiltroLicencias)
    ? (filtroCrudo as FiltroLicencias)
    : 'todas';
  const q = (qCruda ?? '').slice(0, 80);
  const token = await tokenDeSesion();
  const consulta = new URLSearchParams({ filtro, ...(q ? { q } : {}) });
  const [lista, ficha] = await Promise.all([
    llamarApi<ListaLicencias>(`/admin/licencias?${consulta}`, { token }),
    idFicha && /^[0-9a-f-]{36}$/i.test(idFicha)
      ? llamarApi<Ficha>(`/admin/licencias/${idFicha}`, { token })
      : Promise.resolve(null),
  ]);
  if (!lista.ok) {
    return <p className="text-error">No pudimos cargar las licencias: {lista.error.mensaje}</p>;
  }
  const referidos = ficha?.ok
    ? await llamarApi<FichaReferidos>(`/admin/referidos/clientes/${ficha.datos.cliente.id}`, {
        token,
      })
    : null;
  const { licencias, conteos, recortada } = lista.datos;
  const activas = conteos.activas;
  const vencen = conteos.vence;

  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Licencias</Etiqueta>
        <h1 className="text-grande">
          {activas === 1 ? '1 licencia activa.' : `${activas} licencias activas.`}{' '}
          {vencen === 0
            ? ''
            : vencen === 1
              ? '1 vence esta semana.'
              : `${vencen} vencen esta semana.`}
        </h1>
        <p className="max-w-[36em] text-blanco">
          Busca por cliente, correo o cuenta y abre la ficha para ajustar el capital, el riesgo, las
          notas o los días.
        </p>
      </div>

      <section aria-label="Licencias" className="mt-[clamp(56px,7vw,96px)]">
        <nav aria-label="Filtrar licencias" className="mb-5 flex flex-wrap gap-2">
          {FILTROS_LICENCIAS.map((f) => (
            <Link
              key={f}
              href={enlaceLista(f, q)}
              scroll={false}
              aria-current={f === filtro ? 'true' : undefined}
              className="inline-flex min-h-10 items-center gap-2 rounded-pildora bg-campo px-4 py-2 text-sm font-medium text-niebla transition-colors duration-200 hover:bg-campo-foco hover:text-blanco aria-[current=true]:bg-blanco aria-[current=true]:text-vacio"
            >
              {NOMBRE_FILTRO_LICENCIAS[f]}
              <small className="cifra text-xs opacity-75">{conteos[f]}</small>
            </Link>
          ))}
        </nav>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <form action="/admin/licencias" className="flex w-full max-w-[30rem] gap-3">
            {filtro !== 'todas' ? <input type="hidden" name="filtro" value={filtro} /> : null}
            <label htmlFor="buscar" className="sr-only">
              Buscar por cliente, correo o cuenta
            </label>
            <input
              id="buscar"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por cliente, correo o cuenta"
              autoComplete="off"
              spellCheck={false}
              className="min-h-[46px] w-full rounded-pildora bg-campo px-5 text-base text-blanco placeholder:text-white/35 focus-visible:bg-campo-foco focus-visible:shadow-[0_0_0_2px_var(--color-senal)] focus-visible:outline-none"
            />
            <button
              type="submit"
              className="inline-flex min-h-[46px] shrink-0 items-center rounded-pildora bg-campo px-[18px] texto-menu text-blanco transition-colors duration-200 hover:bg-campo-foco"
            >
              Buscar
            </button>
          </form>
          <Exportar filtro={filtro} q={q} />
        </div>

        {licencias.length > 0 ? (
          <div
            tabIndex={0}
            role="region"
            aria-label="Lista de licencias"
            className="relative -mx-2 overflow-x-auto px-2"
          >
            <table className="w-full min-w-[820px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-ceniza">
                  <th scope="col" className="pr-4 pb-3.5 font-normal">
                    Cuenta
                  </th>
                  <th scope="col" className="pr-4 pb-3.5 font-normal">
                    Cliente
                  </th>
                  <th scope="col" className="pr-4 pb-3.5 font-normal">
                    Licencia
                  </th>
                  <th scope="col" className="pr-4 pb-3.5 font-normal">
                    Vence
                  </th>
                  <th scope="col" className="pr-4 pb-3.5 text-right font-normal">
                    Días
                  </th>
                  <th scope="col" className="pr-4 pb-3.5 font-normal">
                    Estado
                  </th>
                  <th scope="col" className="pb-3.5 font-normal">
                    <span className="sr-only">Ficha</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {licencias.map((l) => {
                  const estado = estadoVisible(l);
                  return (
                    <tr
                      key={l.id}
                      className={cx('align-top', l.id === idFicha && 'bg-white/[0.04]')}
                    >
                      <td className="py-3.5 pr-4">
                        <span className="cifra">{l.cuenta.numero}</span>
                        <small className="block text-[13px] text-ceniza" translate="no">
                          {l.cuenta.broker}
                        </small>
                      </td>
                      <td className="py-3.5 pr-4">{l.cliente.nombre}</td>
                      <td className="py-3.5 pr-4">{l.plan ?? '—'}</td>
                      <td className="py-3.5 pr-4 whitespace-nowrap">
                        {l.vence ? fechaCorta(l.vence) : 'Al aprobar'}
                      </td>
                      <td className="cifra py-3.5 pr-4 text-right">
                        {l.dias === null ? '—' : l.dias < 0 ? `−${Math.abs(l.dias)}` : l.dias}
                      </td>
                      <td className="py-3.5 pr-4">
                        <Estado tono={estado.tono}>{estado.texto}</Estado>
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          id={`ficha-${l.id}`}
                          href={enlaceLista(filtro, q, l.id)}
                          scroll={false}
                          className="inline-flex min-h-11 items-center text-sm whitespace-nowrap underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
                        >
                          Ver ficha
                          <span className="sr-only">
                            {' '}
                            de {l.cliente.nombre}, cuenta {l.cuenta.numero}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-niebla">
            Ninguna licencia coincide. Prueba con otro filtro o búsqueda.
          </p>
        )}
        {recortada ? (
          <p className="mt-4 text-sm text-ceniza">
            Se muestran las primeras 500. Usa la búsqueda o un filtro para encontrar las demás, o
            exporta la lista completa.
          </p>
        ) : null}
      </section>

      {ficha?.ok ? (
        <LateralAbierto
          titulo={ficha.datos.cliente.nombre}
          subtitulo={`Cliente desde el ${fechaLarga(ficha.datos.cliente.desde)}`}
          cerrarEn={enlaceLista(filtro, q)}
          idOrigen={`ficha-${ficha.datos.id}`}
        >
          <ContenidoFicha
            ficha={ficha.datos}
            referidos={referidos?.ok ? referidos.datos : null}
            volver={(id) => enlaceLista(filtro, q, id)}
          />
        </LateralAbierto>
      ) : null}
    </>
  );
}

export default function LicenciasAdmin({ searchParams }: { searchParams: Parametros }) {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando las licencias…</p>}>
      <Contenido parametros={searchParams} />
    </Suspense>
  );
}
