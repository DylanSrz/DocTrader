import { enlaceExplorador, formatearPorcentaje } from '@doctrader/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Copiar } from '@/components/panel/copiar';
import { VistaReferidor } from '@/components/referidos/vista-referidor';
import { Enlace, Estado, Etiqueta } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { fechaCorta, usd } from '@/lib/formato';
import type { VistaAdminReferidos, VistaReferidos } from '@/lib/referidos';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import { nombrePeriodo } from '@/lib/socio';
import { AjustesReferidos, AnularComision, MarcarEnviado } from './formularios';

export const metadata: Metadata = { title: 'Referidos' };

const pagos = (n: number) => (n === 1 ? '1 pago' : `${n} pagos`);

async function Contenido() {
  await requerirSesion('ADMIN');
  const token = await tokenDeSesion();
  const r = await llamarApi<VistaAdminReferidos>('/admin/referidos', { token });
  if (!r.ok) {
    return <p className="text-error">No pudimos cargar los referidos: {r.error.mensaje}</p>;
  }
  const { ajustes, acumuladoUsdCents, porEnviar, enviados, referidores } = r.datos;
  const totalPorEnviar = porEnviar.reduce((suma, p) => suma + p.comisionUsdCents, 0);

  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Referidos</Etiqueta>
        <h1 className="text-grande">
          {porEnviar.length > 0 ? (
            <>
              <span className="cifra">{usd(totalPorEnviar)}</span> por enviar en{' '}
              {pagos(porEnviar.length)}.
            </>
          ) : (
            'No hay pagos de referidos por enviar.'
          )}
        </h1>
        <p className="max-w-[38em] text-niebla">
          {ajustes.activo
            ? `El programa está activo: ${formatearPorcentaje(ajustes.porcentajeBp)} de cada licencia que paga un referido${ajustes.segundaLineaBp > 0 ? ` y ${formatearPorcentaje(ajustes.segundaLineaBp)} de las de su segunda línea` : ''}, enviado en USDT (red Tron) cada quincena desde ${usd(ajustes.minimoPagoUsdCents)}.`
            : 'El programa está pausado: los enlaces no suman referidos nuevos y las compras no dejan comisión.'}{' '}
          {acumuladoUsdCents > 0
            ? `Hay ${usd(acumuladoUsdCents)} en comisiones ganadas que todavía no se liquidan.`
            : ''}
        </p>
      </div>

      <div className="mt-[clamp(56px,7vw,96px)] grid grid-cols-[minmax(0,6fr)_minmax(0,5fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-14 max-lg:grid-cols-1">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-[clamp(56px,7vw,80px)]">
          <section aria-labelledby="t-por-enviar" className="grid gap-6">
            <h2 id="t-por-enviar" className="text-medio">
              Por enviar
            </h2>
            {porEnviar.length === 0 ? (
              <p className="text-ceniza">
                Cada quincena, el sistema cierra los pagos de quienes llegaron al mínimo y tienen
                dirección de cobro. Aquí aparecen para enviarlos desde Binance.
              </p>
            ) : (
              <ol className="grid">
                {porEnviar.map((p, i) => (
                  <li
                    key={p.id}
                    className="grid gap-4 border-t border-white/8 py-7 first:border-t-0 first:pt-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <p className="text-medio">
                        <span className="cifra">{usd(p.comisionUsdCents)}</span> a{' '}
                        {p.referidor.nombre}
                      </p>
                      <p className="text-sm text-ceniza">
                        {nombrePeriodo(p.inicio, p.fin)} ·{' '}
                        {p.ventas === 1 ? '1 venta' : `${p.ventas} ventas`}
                      </p>
                    </div>
                    <p className="text-sm text-ceniza">{p.referidor.correo}</p>
                    <div className="grid gap-2">
                      <p className="text-sm text-ceniza">Enviar USDT por la red Tron (TRC20) a</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <p
                          id={`direccion-${i}`}
                          translate="no"
                          className="cifra text-[15px] break-all text-blanco"
                        >
                          {p.direccion}
                        </p>
                        <Copiar texto={p.direccion} idTexto={`direccion-${i}`} que="Dirección" />
                      </div>
                    </div>
                    <MarcarEnviado id={p.id} referidor={p.referidor.nombre} />
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="t-referidores">
            <h2 id="t-referidores" className="mb-7 text-medio">
              Referidores
            </h2>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="t-referidores"
              className="-mx-2 overflow-x-auto px-2"
            >
              <table className="w-full min-w-[640px] border-collapse text-[15px]">
                <thead>
                  <tr className="text-left text-[13px] text-ceniza">
                    <th scope="col" className="pr-4 pb-3.5 font-normal">
                      Referidor
                    </th>
                    <th scope="col" className="pr-4 pb-3.5 text-right font-normal">
                      Registrados
                      <small className="block text-[12px]">1.ª + 2.ª línea</small>
                    </th>
                    <th scope="col" className="pr-4 pb-3.5 text-right font-normal">
                      Compraron
                      <small className="block text-[12px]">1.ª + 2.ª línea</small>
                    </th>
                    <th scope="col" className="pr-4 pb-3.5 text-right font-normal">
                      Ganado
                    </th>
                    <th scope="col" className="pb-3.5 font-normal">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {referidores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-ceniza">
                        Todavía nadie se ha registrado con un enlace de referido.
                      </td>
                    </tr>
                  ) : (
                    referidores.map((x) => (
                      <tr key={x.id} className="align-top">
                        <td className="py-4 pr-4">
                          {x.esAdmin ? (
                            x.nombre
                          ) : (
                            <Enlace
                              href={`/admin/licencias?q=${encodeURIComponent(x.correo)}`}
                              className="min-h-0"
                            >
                              {x.nombre}
                            </Enlace>
                          )}
                          <small className="block text-[13px] text-ceniza">
                            <span className="cifra">{x.codigo}</span> · {x.correo}
                          </small>
                        </td>
                        <td className="cifra py-4 pr-4 text-right">
                          {x.registrados}
                          {x.registradosSegunda > 0 ? (
                            <span className="text-ceniza"> + {x.registradosSegunda}</span>
                          ) : null}
                        </td>
                        <td className="cifra py-4 pr-4 text-right">
                          {x.compradores}
                          {x.compradoresSegunda > 0 ? (
                            <span className="text-ceniza"> + {x.compradoresSegunda}</span>
                          ) : null}
                        </td>
                        <td className="cifra py-4 pr-4 text-right">
                          {usd(x.ganadoUsdCents)}
                          {x.acumuladoUsdCents > 0 ? (
                            <small className="block text-[13px] text-ceniza">
                              {usd(x.acumuladoUsdCents)} sin liquidar
                            </small>
                          ) : null}
                        </td>
                        <td className="grid justify-items-start gap-1.5 py-4">
                          {x.esAdmin ? (
                            <Estado tono="neutro">{x.esSocio ? 'Socio' : 'Admin'}</Estado>
                          ) : null}
                          {x.habilitado ? <Estado tono="senal">Habilitado</Estado> : null}
                          {!x.conDireccion ? <Estado tono="apagado">Sin dirección</Estado> : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {enviados.length > 0 ? (
            <section aria-labelledby="t-enviados">
              <h2 id="t-enviados" className="mb-7 text-medio">
                Enviados
              </h2>
              <ol className="grid gap-4 text-[15px]">
                {enviados.map((p) => {
                  const explorador = p.hash ? enlaceExplorador('TRON', p.hash) : null;
                  return (
                    <li
                      key={p.id}
                      className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 max-sm:grid-cols-1 max-sm:gap-1"
                    >
                      <time dateTime={p.enviadoEn} className="cifra text-ceniza">
                        {fechaCorta(p.enviadoEn)}
                      </time>
                      <div className="min-w-0">
                        <p>
                          <span className="cifra">{usd(p.comisionUsdCents)}</span> a {p.referidor}
                          <span className="text-ceniza">
                            {' '}
                            · {nombrePeriodo(p.inicio, p.fin)}
                            {p.enviadoPor ? ` · lo marcó ${p.enviadoPor}` : ''}
                          </span>
                        </p>
                        {explorador ? (
                          <Enlace href={explorador} target="_blank" rel="noopener" gris>
                            Ver en Tronscan
                          </Enlace>
                        ) : p.hash ? (
                          <p className="truncate text-[13px] text-ceniza">{p.hash}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-[clamp(56px,7vw,80px)]">
          <section aria-labelledby="t-ajustes" className="grid justify-items-start gap-5">
            <h2 id="t-ajustes" className="text-medio">
              Ajustes del programa
            </h2>
            <AjustesReferidos
              porcentaje={formatearPorcentaje(ajustes.porcentajeBp).replace(/\s?%$/, '')}
              segundaLinea={formatearPorcentaje(ajustes.segundaLineaBp).replace(/\s?%$/, '')}
              minimo={String(ajustes.minimoPagoUsdCents / 100)}
              activo={ajustes.activo}
            />
          </section>
          <section aria-labelledby="t-anular" className="grid justify-items-start gap-4">
            <h2 id="t-anular" className="text-medio">
              Anular una comisión
            </h2>
            <p className="max-w-[30em] text-sm text-ceniza">
              Para una venta que no debe dejar comisión: un autorreferido, un fraude o un error.
              Para cambiar quién invitó a un cliente, hazlo desde su ficha en Licencias.
            </p>
            <AnularComision />
          </section>
        </div>
      </div>

      <MisReferidos token={token} />
    </>
  );
}

/** Cada admin también refiere con su cuenta: su enlace, su red hasta la segunda línea y su dirección de cobro. */
async function MisReferidos({ token }: { token: string | undefined }) {
  const r = await llamarApi<VistaReferidos>('/referidos/mio', { token });
  if (!r.ok) return null;
  return (
    <section
      aria-label="Mis referidos"
      className="mt-[clamp(80px,10vw,140px)] border-t border-white/8 pt-[clamp(48px,6vw,80px)]"
    >
      <VistaReferidor vista={r.datos} titular={false} />
    </section>
  );
}

export default function ReferidosAdmin() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando los referidos…</p>}>
      <Contenido />
    </Suspense>
  );
}
