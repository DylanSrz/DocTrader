import { formatearPorcentaje } from '@doctrader/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VistaReferidor } from '@/components/referidos/vista-referidor';
import { Estado, Etiqueta } from '@/components/ui';
import { llamarApi } from '@/lib/api';
import { fechaCorta, usd } from '@/lib/formato';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import type { VistaReferidos } from '@/lib/referidos';
import { diaYMes, nombrePeriodo, type VistaSocio } from '@/lib/socio';
import { EditarPorcentaje, MarcarPagada } from './formularios';

export const metadata: Metadata = { title: 'Socio' };

const ventas = (n: number) => (n === 1 ? '1 venta' : `${n} ventas`);
/** "10", "12,5": el valor del campo, sin el signo. */
const valorPorcentaje = (bp: number) => formatearPorcentaje(bp).replace(/ %$/, '');

async function Contenido() {
  await requerirSesion('ADMIN');
  const token = await tokenDeSesion();
  const r = await llamarApi<VistaSocio>('/admin/socio', { token });
  if (!r.ok) {
    return <p className="text-error">No pudimos cargar el perfil del socio: {r.error.mensaje}</p>;
  }
  const { socio, actual, porPagarUsdCents = 0, liquidaciones = [], cambios = [] } = r.datos;
  if (!socio || !actual) {
    return (
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Socio</Etiqueta>
        <h1 className="text-grande">No hay un socio configurado.</h1>
      </div>
    );
  }
  const porPagar = liquidaciones.filter((l) => l.estado === 'CERRADA');
  const pct = formatearPorcentaje(socio.porcentajeBp);

  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Socio</Etiqueta>
        <h1 className="text-grande">
          <span className="cifra">{usd(actual.comisionUsdCents)}</span> de comisión para el{' '}
          {diaYMes(actual.fin)}.
        </h1>
        <p className="max-w-[36em] text-blanco">
          {actual.ventas > 0
            ? `Es la comisión de ${usd(actual.brutoUsdCents)} en ventas brutas aprobadas (${ventas(actual.ventas)}) desde el ${diaYMes(actual.inicio)}. Sigue sumando hasta el ${diaYMes(actual.fin)}.`
            : `Todavía no hay ventas aprobadas en esta quincena, del ${diaYMes(actual.inicio)} al ${diaYMes(actual.fin)}.`}
          {porPagarUsdCents > 0
            ? ` Quedan ${usd(porPagarUsdCents)} por pagar de quincenas ya cerradas.`
            : ''}
        </p>
      </div>

      <div className="mt-[clamp(56px,7vw,96px)] grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-14 max-lg:grid-cols-1">
        <section aria-labelledby="t-porcentaje" className="grid min-w-0 justify-items-start gap-3">
          <h2 id="t-porcentaje" className="text-sm text-ceniza">
            Porcentaje de comisión de {socio.nombre}
          </h2>
          <strong className="cifra text-[clamp(64px,9vw,120px)] leading-[0.95] font-normal tracking-[-0.05em]">
            {pct}
          </strong>
          <p className="max-w-[26em] text-sm text-ceniza">
            {socio.esElSocio
              ? 'Tu porcentaje sobre las ventas brutas aprobadas. Cada venta guarda el porcentaje con el que se aprobó.'
              : 'Sobre las ventas brutas aprobadas. Solo el socio puede cambiarlo, desde su perfil.'}
          </p>
          {socio.esElSocio ? (
            <div className="mt-6 w-full">
              <EditarPorcentaje porcentaje={valorPorcentaje(socio.porcentajeBp)} />
            </div>
          ) : null}
        </section>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-[clamp(56px,7vw,80px)]">
          <section aria-labelledby="t-liquidaciones">
            <h2 id="t-liquidaciones" className="mb-7 text-medio">
              Liquidaciones
            </h2>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="t-liquidaciones"
              className="-mx-2 overflow-x-auto px-2"
            >
              <table className="w-full min-w-[560px] border-collapse text-[15px]">
                <thead>
                  <tr className="text-left text-[13px] text-ceniza">
                    <th scope="col" className="pr-4 pb-3.5 font-normal">
                      Periodo
                    </th>
                    <th scope="col" className="pr-4 pb-3.5 text-right font-normal">
                      Ventas brutas
                    </th>
                    <th scope="col" className="pr-4 pb-3.5 text-right font-normal">
                      Comisión
                    </th>
                    <th scope="col" className="pb-3.5 font-normal">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="align-top">
                    <td className="py-4 pr-4 whitespace-nowrap">
                      {nombrePeriodo(actual.inicio, actual.fin)}
                      <small className="block text-[13px] text-ceniza">
                        {ventas(actual.ventas)}
                      </small>
                    </td>
                    <td className="cifra py-4 pr-4 text-right">{usd(actual.brutoUsdCents)}</td>
                    <td className="cifra py-4 pr-4 text-right">{usd(actual.comisionUsdCents)}</td>
                    <td className="py-4">
                      <Estado tono="neutro">Se liquida el {diaYMes(actual.fin)}</Estado>
                    </td>
                  </tr>
                  {liquidaciones.map((l) => (
                    <tr key={l.id} className="align-top">
                      <td className="py-4 pr-4 whitespace-nowrap">
                        {nombrePeriodo(l.inicio, l.fin)}
                        <small className="block text-[13px] text-ceniza">{ventas(l.ventas)}</small>
                      </td>
                      <td className="cifra py-4 pr-4 text-right">{usd(l.brutoUsdCents)}</td>
                      <td className="cifra py-4 pr-4 text-right">{usd(l.comisionUsdCents)}</td>
                      <td className="py-4">
                        {l.estado === 'PAGADA' ? (
                          <>
                            <Estado tono="senal">
                              Pagada el {l.pagadaEn ? fechaCorta(l.pagadaEn) : ''}
                            </Estado>
                            {l.referencia ? (
                              <small className="mt-1.5 block max-w-[16em] truncate text-[13px] text-ceniza">
                                Ref. {l.referencia}
                              </small>
                            ) : null}
                          </>
                        ) : (
                          <Estado tono="llama">Por pagar</Estado>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {porPagar.length > 0 ? (
            <section aria-labelledby="t-por-pagar" className="grid gap-6">
              <h2 id="t-por-pagar" className="text-medio">
                Por pagar
              </h2>
              <ol className="grid">
                {porPagar.map((l) => {
                  const periodo = nombrePeriodo(l.inicio, l.fin);
                  return (
                    <li
                      key={l.id}
                      className="grid gap-4 border-t border-white/8 py-6 first:border-t-0 first:pt-0"
                    >
                      <p>
                        <span className="cifra">{usd(l.comisionUsdCents)}</span> de la quincena del{' '}
                        {periodo}
                      </p>
                      <MarcarPagada id={l.id} periodo={periodo} />
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          <section aria-labelledby="t-cambios" className="grid gap-5">
            <h2 id="t-cambios" className="text-medio">
              Cambios de porcentaje
            </h2>
            <ol className="grid gap-3 text-[15px]">
              {cambios.map((c) => (
                <li key={c.fecha} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4">
                  <time dateTime={c.fecha} className="cifra text-ceniza">
                    {fechaCorta(c.fecha)}
                  </time>
                  <p>
                    {c.anteriorBp === null ? (
                      <>
                        Porcentaje inicial:{' '}
                        <b className="font-medium">{formatearPorcentaje(c.nuevoBp)}</b>.
                      </>
                    ) : (
                      <>
                        {c.quien ? `${c.quien} lo cambió` : 'Cambió'} de{' '}
                        {formatearPorcentaje(c.anteriorBp)} a{' '}
                        <b className="font-medium">{formatearPorcentaje(c.nuevoBp)}</b>.
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {socio.esElSocio ? <MisReferidos token={token} /> : null}
    </>
  );
}

/** El socio también refiere con su cuenta de admin: su enlace, sus cifras y su dirección de cobro. */
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

export default function SocioAdmin() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando el perfil del socio…</p>}>
      <Contenido />
    </Suspense>
  );
}
