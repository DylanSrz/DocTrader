import {
  FILTROS_CLIENTES,
  type FiltroClientes,
  formatearTelefono,
  NOMBRE_FILTRO_CLIENTES,
  NOMBRE_TEMA,
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
  type FichaCliente,
  type ListaClientes,
  NOMBRE_CONEXION,
} from '@/lib/admin';
import { llamarApi } from '@/lib/api';
import { conceptoOrden, ESTADO_ORDEN_VISIBLE, fechaCorta, fechaLarga, usd } from '@/lib/formato';
import type { FichaReferidos } from '@/lib/referidos';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import { ESTADO_TICKET_ADMIN } from '@/lib/soporte';
import {
  Cedula,
  CorregirReferidor,
  EliminarCliente,
  HabilitarReferidor,
} from '../licencias/acciones-licencia';

export const metadata: Metadata = { title: 'Clientes' };

type Parametros = Promise<{ filtro?: string; q?: string; ficha?: string }>;

function enlaceLista(filtro: FiltroClientes, q: string, ficha?: string): string {
  const p = new URLSearchParams();
  if (filtro !== 'todos') p.set('filtro', filtro);
  if (q) p.set('q', q);
  if (ficha) p.set('ficha', ficha);
  const texto = p.toString();
  return texto ? `/admin/clientes?${texto}` : '/admin/clientes';
}

const clasesEnlace =
  'underline decoration-white/35 underline-offset-[6px] hover:decoration-current';

/** Lo más útil de un vistazo: si tiene licencia, si se le venció o si todavía no agrega una cuenta. */
function estadoVisible(c: ListaClientes['clientes'][number]) {
  if (c.estado === 'SUSPENDED') return { texto: 'Suspendido', tono: 'error' as const };
  if (c.licenciasVigentes > 0) {
    return {
      texto: c.licenciasVigentes === 1 ? '1 licencia' : `${c.licenciasVigentes} licencias`,
      tono: 'senal' as const,
    };
  }
  if (c.algunaVencida) return { texto: 'Vencido', tono: 'llama' as const };
  if (c.cuentas === 0) return { texto: 'Sin cuenta', tono: 'apagado' as const };
  return { texto: 'Sin pagar', tono: 'neutro' as const };
}

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
}: {
  ficha: FichaCliente;
  referidos: FichaReferidos | null;
}) {
  const { cliente } = ficha;
  const eliminado = cliente.estado === 'DELETED';
  return (
    <>
      {eliminado ? null : (
        <Seccion titulo="Contacto">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-6 gap-y-1 text-[15px]">
            <dt className="text-ceniza">
              {cliente.documentoPais && cliente.documentoTipo
                ? nombreDocumento(cliente.documentoPais, cliente.documentoTipo)
                : 'Documento'}
              {cliente.documentoPais && cliente.documentoPais !== 'CO' ? (
                <small className="block text-[13px]">{nombrePais(cliente.documentoPais)}</small>
              ) : null}
            </dt>
            <dd>
              <Cedula cliente={cliente.id} final={cliente.cedulaFinal} />
            </dd>
            <dt className="text-ceniza">Correo</dt>
            <dd className="flex min-h-11 items-center [overflow-wrap:anywhere]">
              <a
                href={`mailto:${cliente.correo}`}
                className="underline decoration-white/35 underline-offset-4"
              >
                {cliente.correo}
              </a>
              {cliente.correoVerificado ? null : (
                <span className="ml-2 text-ceniza">(sin confirmar)</span>
              )}
            </dd>
            <dt className="text-ceniza">Teléfono</dt>
            <dd className="cifra flex min-h-11 items-center">
              {cliente.telefono ? formatearTelefono(cliente.telefono) : '—'}
            </dd>
            <dt className="text-ceniza">Novedades</dt>
            <dd className="flex min-h-11 items-center">
              {cliente.aceptaPublicidad ? 'Acepta recibirlas' : 'No las recibe'}
            </dd>
          </dl>
        </Seccion>
      )}

      <Seccion titulo="Cuentas de trading">
        {ficha.cuentas.length === 0 ? (
          <p className="text-[15px] text-niebla">
            Todavía no agrega una cuenta de trading, así que no tiene licencias.
          </p>
        ) : (
          <ul className="grid gap-3 text-[15px]">
            {ficha.cuentas.map((c) => {
              const estado = c.licencia ? ESTADO_LICENCIA_ADMIN[c.licencia.estado] : null;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                >
                  <span>
                    {c.licencia ? (
                      <Link
                        href={`/admin/licencias?ficha=${c.licencia.id}`}
                        className={cx('cifra', clasesEnlace)}
                      >
                        {c.numero}
                      </Link>
                    ) : (
                      <span className="cifra">{c.numero}</span>
                    )}
                    <small className="block text-[13px] text-ceniza">
                      <span translate="no">{c.broker}</span> · {NOMBRE_CONEXION[c.conexion]}
                      {c.licencia?.plan ? ` · ${c.licencia.plan}` : ''}
                      {c.licencia?.vence ? ` · vence el ${fechaCorta(c.licencia.vence)}` : ''}
                    </small>
                  </span>
                  {estado ? <Estado tono={estado.tono}>{estado.texto}</Estado> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Seccion>

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
                    {p.cuenta ? ` · cuenta ${p.cuenta}` : ''}
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

      {ficha.tickets.length > 0 ? (
        <Seccion titulo="Soporte">
          <ol className="grid gap-3 text-[15px]">
            {ficha.tickets.map((t) => (
              <li
                key={t.numero}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
              >
                <span className="min-w-0">
                  <Link
                    href={`/admin/soporte?vista=todos&ticket=${t.numero}`}
                    className={clasesEnlace}
                  >
                    {t.asunto}
                  </Link>
                  <small className="block text-[13px] text-ceniza">
                    #{t.numero} · {NOMBRE_TEMA[t.tema]} · {fechaCorta(t.ultimoMensaje)}
                  </small>
                </span>
                <Estado tono={ESTADO_TICKET_ADMIN[t.estado].tono}>
                  {ESTADO_TICKET_ADMIN[t.estado].texto}
                </Estado>
              </li>
            ))}
          </ol>
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
          <CorregirReferidor cliente={cliente.id} />
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
            ) : null}{' '}
            Su red: <span className="cifra">{ficha.red.primeraLinea}</span> en primera línea y{' '}
            <span className="cifra">{ficha.red.segundaLinea}</span> en segunda.
          </p>
          <HabilitarReferidor
            cliente={cliente.id}
            habilitado={referidos.perfil?.habilitado === true}
          />
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
            Solo si el cliente lo pide. Se borran su nombre, documento, correo, teléfono, las
            contraseñas de sus cuentas y sus tickets; sus licencias terminan y una cuenta conectada
            queda por desconectar. Se conservan sus órdenes y pagos. No se puede deshacer.
          </p>
          <EliminarCliente cliente={cliente.id} />
        </Seccion>
      )}
    </>
  );
}

async function Contenido({ parametros }: { parametros: Parametros }) {
  await requerirSesion('ADMIN');
  const { filtro: filtroCrudo, q: qCruda, ficha: idFicha } = await parametros;
  const filtro = FILTROS_CLIENTES.includes(filtroCrudo as FiltroClientes)
    ? (filtroCrudo as FiltroClientes)
    : 'todos';
  const q = (qCruda ?? '').slice(0, 80);
  const token = await tokenDeSesion();
  const consulta = new URLSearchParams({ filtro, ...(q ? { q } : {}) });
  const idValido = idFicha && /^[0-9a-f-]{36}$/i.test(idFicha) ? idFicha : null;
  const [lista, ficha, referidos] = await Promise.all([
    llamarApi<ListaClientes>(`/admin/clientes?${consulta}`, { token }),
    idValido
      ? llamarApi<FichaCliente>(`/admin/clientes/${idValido}`, { token })
      : Promise.resolve(null),
    idValido
      ? llamarApi<FichaReferidos>(`/admin/referidos/clientes/${idValido}`, { token })
      : Promise.resolve(null),
  ]);
  if (!lista.ok) {
    return <p className="text-error">No pudimos cargar los clientes: {lista.error.mensaje}</p>;
  }
  const { clientes, conteos, recortada } = lista.datos;

  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Clientes</Etiqueta>
        <h1 className="text-grande">
          {conteos.todos === 1 ? '1 cliente registrado.' : `${conteos.todos} clientes registrados.`}{' '}
          {conteos.sin_cuenta === 0
            ? ''
            : conteos.sin_cuenta === 1
              ? '1 sin cuenta de trading.'
              : `${conteos.sin_cuenta} sin cuenta de trading.`}
        </h1>
        <p className="max-w-[36em] text-blanco">
          Todos los que se registraron, hayan comprado o no. Busca por nombre, correo, teléfono o
          número de cuenta y abre la ficha para ver sus cuentas, pagos, tickets y referidos.
        </p>
      </div>

      <section aria-label="Clientes" className="mt-[clamp(56px,7vw,96px)]">
        <nav aria-label="Filtrar clientes" className="mb-5 flex flex-wrap gap-2">
          {FILTROS_CLIENTES.map((f) => (
            <Link
              key={f}
              href={enlaceLista(f, q)}
              scroll={false}
              aria-current={f === filtro ? 'true' : undefined}
              className="inline-flex min-h-10 items-center gap-2 rounded-pildora bg-campo px-4 py-2 text-sm font-medium text-niebla transition-colors duration-200 hover:bg-campo-foco hover:text-blanco aria-[current=true]:bg-blanco aria-[current=true]:text-vacio"
            >
              {NOMBRE_FILTRO_CLIENTES[f]}
              <small className="cifra text-xs opacity-75">{conteos[f]}</small>
            </Link>
          ))}
        </nav>
        <form action="/admin/clientes" className="mb-6 flex w-full max-w-[30rem] gap-3">
          {filtro !== 'todos' ? <input type="hidden" name="filtro" value={filtro} /> : null}
          <label htmlFor="buscar" className="sr-only">
            Buscar por nombre, correo, teléfono o cuenta
          </label>
          <input
            id="buscar"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nombre, correo, teléfono o cuenta"
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

        {clientes.length > 0 ? (
          <div
            tabIndex={0}
            role="region"
            aria-label="Lista de clientes"
            className="relative -mx-2 overflow-x-auto px-2"
          >
            <table className="w-full min-w-[820px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-ceniza">
                  <th scope="col" className="pr-4 pb-3.5 font-normal">
                    Cliente
                  </th>
                  <th scope="col" className="pr-4 pb-3.5 font-normal">
                    Teléfono
                  </th>
                  <th scope="col" className="pr-4 pb-3.5 font-normal">
                    Registro
                  </th>
                  <th scope="col" className="pr-4 pb-3.5 text-right font-normal">
                    Cuentas
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
                {clientes.map((c) => {
                  const estado = estadoVisible(c);
                  return (
                    <tr
                      key={c.id}
                      className={cx('align-top', c.id === idFicha && 'bg-white/[0.04]')}
                    >
                      <td className="py-3.5 pr-4">
                        {c.nombre}
                        <small className="block text-[13px] text-ceniza [overflow-wrap:anywhere]">
                          {c.correo}
                          {c.correoVerificado ? '' : ' (sin confirmar)'}
                          {c.invitadoPor ? ` · invitado por ${c.invitadoPor}` : ''}
                        </small>
                      </td>
                      <td className="cifra py-3.5 pr-4 whitespace-nowrap">
                        {c.telefono ? formatearTelefono(c.telefono) : '—'}
                      </td>
                      <td className="py-3.5 pr-4 whitespace-nowrap">{fechaCorta(c.desde)}</td>
                      <td className="cifra py-3.5 pr-4 text-right">{c.cuentas}</td>
                      <td className="grid justify-items-start gap-1.5 py-3.5 pr-4">
                        <Estado tono={estado.tono}>{estado.texto}</Estado>
                        {c.habilitado ? (
                          <Estado tono="senal">Referidor habilitado</Estado>
                        ) : c.referidor ? (
                          <Estado tono="neutro">Referidor</Estado>
                        ) : null}
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          id={`ficha-${c.id}`}
                          href={enlaceLista(filtro, q, c.id)}
                          scroll={false}
                          className="inline-flex min-h-11 items-center text-sm whitespace-nowrap underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
                        >
                          Ver ficha
                          <span className="sr-only"> de {c.nombre}</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-niebla">Ningún cliente coincide. Prueba con otro filtro o búsqueda.</p>
        )}
        {recortada ? (
          <p className="mt-4 text-sm text-ceniza">
            Se muestran los 500 más recientes. Usa la búsqueda o un filtro para encontrar a los
            demás.
          </p>
        ) : null}
      </section>

      {ficha?.ok ? (
        <LateralAbierto
          titulo={ficha.datos.cliente.nombre}
          subtitulo={`Registrado el ${fechaLarga(ficha.datos.cliente.desde)}`}
          cerrarEn={enlaceLista(filtro, q)}
          idOrigen={`ficha-${ficha.datos.cliente.id}`}
        >
          <ContenidoFicha ficha={ficha.datos} referidos={referidos?.ok ? referidos.datos : null} />
        </LateralAbierto>
      ) : null}
    </>
  );
}

export default function ClientesAdmin({ searchParams }: { searchParams: Parametros }) {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando los clientes…</p>}>
      <Contenido parametros={searchParams} />
    </Suspense>
  );
}
