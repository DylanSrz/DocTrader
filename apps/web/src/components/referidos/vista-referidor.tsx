import { enlaceExplorador, formatearPorcentaje } from '@doctrader/shared';
import type { ReactNode } from 'react';
import { CodigoQr } from '@/components/panel/codigo-qr';
import { Copiar } from '@/components/panel/copiar';
import { Enlace, Estado, Etiqueta, Pildora } from '@/components/ui';
import { fechaCorta, fechaLarga, usd } from '@/lib/formato';
import { enlaceDeReferido, type EstadoReferido, type VistaReferidos } from '@/lib/referidos';
import { diaYMes, nombrePeriodo } from '@/lib/socio';
import { FormularioDireccion } from './formulario-direccion';

const ESTADO_REFERIDO: Record<
  EstadoReferido,
  { texto: string; tono: 'senal' | 'neutro' | 'apagado' }
> = {
  CON_LICENCIA: { texto: 'Con licencia', tono: 'senal' },
  REGISTRADO: { texto: 'Registrado', tono: 'neutro' },
  VENCIDA: { texto: 'Licencia vencida', tono: 'apagado' },
};

const ESTADO_COMISION = {
  ACUMULADA: { texto: 'Acumulada', tono: 'neutro' },
  CERRADA: { texto: 'Por enviar', tono: 'llama' },
  PAGADA: { texto: 'Enviada', tono: 'senal' },
} as const;

function Tabla({
  id,
  titulo,
  columnas,
  children,
  minimo = 560,
}: {
  id: string;
  titulo: string;
  columnas: { texto: string; derecha?: boolean }[];
  children: ReactNode;
  minimo?: number;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-7 text-medio">
        {titulo}
      </h2>
      <div tabIndex={0} role="region" aria-labelledby={id} className="-mx-2 overflow-x-auto px-2">
        <table className="w-full border-collapse text-[15px]" style={{ minWidth: minimo }}>
          <thead>
            <tr className="text-left text-[13px] text-ceniza">
              {columnas.map((c) => (
                <th
                  key={c.texto}
                  scope="col"
                  className={`pr-4 pb-3.5 font-normal last:pr-0 ${c.derecha ? 'text-right' : ''}`}
                >
                  {c.texto}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * El programa de referidos visto por quien refiere: su enlace, sus cifras, su dirección de cobro, sus referidos, sus
 * comisiones y sus pagos. La usan el panel del cliente (`/panel/referidos`) y el perfil del socio (`/admin/socio`).
 */
export function VistaReferidor({
  vista,
  titular = true,
}: {
  vista: VistaReferidos;
  /** El título grande de la página: en el perfil del socio, la sección va debajo de otro título. */
  titular?: boolean;
}) {
  const { programa, perfil, cifras } = vista;
  const pct = formatearPorcentaje(programa.porcentajeBp);
  const minimo = usd(programa.minimoPagoUsdCents);

  if (!perfil || !cifras) {
    return (
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        {titular ? <Etiqueta>Referidos</Etiqueta> : null}
        <h1 className={titular ? 'text-grande' : 'text-medio'}>
          {programa.activo
            ? `Recomienda DocTrader Pro y gana el ${pct} de cada licencia.`
            : 'El programa de referidos está pausado.'}
        </h1>
        {programa.activo ? (
          <>
            <p className="max-w-[36em] text-blanco">
              Con una licencia activa tienes tu propio enlace. Cada vez que alguien que invitaste
              paga una licencia, ganas el {pct} de lo que pagó, mientras siga siendo cliente. Te
              enviamos lo ganado en USDT (red Tron) cada quincena, desde {minimo}.
            </p>
            <Pildora href="/comprar/mensual">Comprar una licencia</Pildora>
          </>
        ) : (
          <p className="max-w-[36em] text-niebla">
            Por ahora no se registran referidos nuevos. Te avisaremos cuando vuelva.
          </p>
        )}
      </div>
    );
  }

  const enlace = enlaceDeReferido(perfil.codigo);
  const numeros = [
    { texto: 'Registrados', valor: String(cifras.registrados) },
    { texto: 'Compraron', valor: String(cifras.compradores) },
    {
      texto: `Esta quincena, hasta el ${diaYMes(cifras.periodo.fin)}`,
      valor: usd(cifras.periodo.comisionUsdCents),
    },
    { texto: 'Por liquidar', valor: usd(cifras.acumuladoUsdCents) },
    { texto: 'Por enviarte', valor: usd(cifras.porPagarUsdCents) },
    { texto: 'Enviado', valor: usd(cifras.pagadoUsdCents) },
  ];
  const referidos = vista.referidos ?? [];
  const comisiones = vista.comisiones ?? [];
  const pagos = vista.pagos ?? [];
  const Titulo = titular ? 'h1' : 'h2';

  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        {titular ? <Etiqueta>Referidos</Etiqueta> : null}
        <Titulo className={titular ? 'text-grande' : 'text-medio'}>
          Gana el {pct} de cada licencia que paguen tus referidos.
        </Titulo>
        <p className="max-w-[38em] text-niebla">
          Comparte tu enlace. Quien se registre con él queda como tu referido, y cada licencia que
          pague te deja el {pct} mientras tengas tu licencia activa. Cada quincena te enviamos lo
          ganado en USDT (red Tron) si llega a {minimo}; si no, se suma a la siguiente.
        </p>
        {!programa.activo ? (
          <p role="status" className="rounded-[20px] bg-llama/14 px-5 py-4 text-[15px] text-llama">
            El programa está pausado: tu enlace no suma referidos nuevos por ahora. Lo que ya
            ganaste se te envía igual.
          </p>
        ) : null}
      </div>

      <div className="mt-[clamp(48px,6vw,80px)] grid grid-cols-[minmax(0,6fr)_auto] items-center gap-[clamp(32px,5vw,72px)] max-md:grid-cols-1">
        <section aria-labelledby="t-enlace" className="grid min-w-0 justify-items-start gap-4">
          <h2 id="t-enlace" className="text-sm text-ceniza">
            Tu enlace de invitación
          </h2>
          <p
            id="enlace-referido"
            translate="no"
            className="cifra max-w-full text-[clamp(20px,2.6vw,32px)] leading-tight tracking-[-0.02em] break-all"
          >
            {enlace.replace(/^https?:\/\//, '')}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Copiar texto={enlace} idTexto="enlace-referido" que="Enlace" />
            <p className="text-sm text-ceniza">
              Código <span className="cifra text-blanco">{perfil.codigo}</span>, por si lo escriben
              a mano al registrarse.
            </p>
          </div>
        </section>
        <CodigoQr
          texto={enlace}
          etiqueta="Código QR de tu enlace de invitación"
          className="size-36 justify-self-start"
        />
      </div>

      <section aria-labelledby="t-cifras" className="mt-[clamp(48px,6vw,80px)]">
        <h2 id="t-cifras" className="sr-only">
          Tus cifras
        </h2>
        <dl className="grid grid-cols-3 gap-x-[clamp(24px,4vw,56px)] gap-y-8 max-md:grid-cols-2">
          {numeros.map((n) => (
            <div key={n.texto} className="grid content-start gap-2 border-t border-white/8 pt-5">
              <dt className="text-sm text-ceniza">{n.texto}</dt>
              <dd className="cifra text-[clamp(28px,3.4vw,44px)] leading-none tracking-[-0.03em]">
                {n.valor}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-[clamp(56px,7vw,96px)] grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-14 max-lg:grid-cols-1">
        <section aria-labelledby="t-cobro" className="grid min-w-0 justify-items-start gap-4">
          <h2 id="t-cobro" className="text-medio">
            Dónde te pagamos
          </h2>
          {perfil.enEsperaHasta ? (
            <p role="status" className="text-[15px] text-llama">
              Cambiaste la dirección hace poco: por seguridad, el próximo pago espera hasta el{' '}
              {fechaLarga(perfil.enEsperaHasta)}.
            </p>
          ) : !perfil.direccion && cifras.acumuladoUsdCents > 0 ? (
            <p role="status" className="text-[15px] text-llama">
              Tienes {usd(cifras.acumuladoUsdCents)} por cobrar: registra tu dirección para
              recibirlos.
            </p>
          ) : null}
          <FormularioDireccion actual={perfil.direccion} esperaHoras={programa.esperaHoras} />
        </section>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-[clamp(56px,7vw,80px)]">
          <Tabla
            id="t-referidos"
            titulo="Tus referidos"
            minimo={340}
            columnas={[{ texto: 'Nombre' }, { texto: 'Desde' }, { texto: 'Estado' }]}
          >
            {referidos.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-ceniza">
                  Todavía nadie se ha registrado con tu enlace.
                </td>
              </tr>
            ) : (
              referidos.map((r, i) => (
                <tr key={`${r.nombre}-${i}`} className="align-top">
                  <td className="py-4 pr-4">{r.nombre}</td>
                  <td className="cifra py-4 pr-4 whitespace-nowrap text-ceniza">
                    {r.registradoEn ? fechaCorta(r.registradoEn) : '—'}
                  </td>
                  <td className="py-4">
                    <Estado tono={ESTADO_REFERIDO[r.estado].tono}>
                      {ESTADO_REFERIDO[r.estado].texto}
                    </Estado>
                  </td>
                </tr>
              ))
            )}
          </Tabla>

          <Tabla
            id="t-comisiones"
            titulo="Comisiones"
            columnas={[
              { texto: 'Fecha' },
              { texto: 'Referido' },
              { texto: 'Pagó', derecha: true },
              { texto: 'Tu comisión', derecha: true },
              { texto: 'Estado' },
            ]}
          >
            {comisiones.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-ceniza">
                  Aquí verás cada licencia que paguen tus referidos.
                </td>
              </tr>
            ) : (
              comisiones.map((c, i) => (
                <tr key={`${c.fecha}-${i}`} className="align-top">
                  <td className="cifra py-4 pr-4 whitespace-nowrap text-ceniza">
                    {fechaCorta(c.fecha)}
                  </td>
                  <td className="py-4 pr-4">
                    {c.referido}
                    <small className="block text-[13px] text-ceniza">{c.plan}</small>
                  </td>
                  <td className="cifra py-4 pr-4 text-right">{usd(c.montoUsdCents)}</td>
                  <td className="cifra py-4 pr-4 text-right">{usd(c.comisionUsdCents)}</td>
                  <td className="py-4">
                    <Estado tono={ESTADO_COMISION[c.estado].tono}>
                      {ESTADO_COMISION[c.estado].texto}
                    </Estado>
                  </td>
                </tr>
              ))
            )}
          </Tabla>

          {pagos.length > 0 ? (
            <Tabla
              id="t-pagos"
              titulo="Pagos"
              columnas={[
                { texto: 'Quincenas' },
                { texto: 'Monto', derecha: true },
                { texto: 'Estado' },
              ]}
            >
              {pagos.map((p) => {
                const explorador = p.hash ? enlaceExplorador('TRON', p.hash) : null;
                return (
                  <tr key={p.id} className="align-top">
                    <td className="py-4 pr-4 whitespace-nowrap">
                      {nombrePeriodo(p.inicio, p.fin)}
                      <small className="block text-[13px] text-ceniza">
                        {p.ventas === 1 ? '1 venta' : `${p.ventas} ventas`}
                      </small>
                    </td>
                    <td className="cifra py-4 pr-4 text-right">{usd(p.comisionUsdCents)}</td>
                    <td className="py-4">
                      {p.estado === 'PAGADA' ? (
                        <>
                          <Estado tono="senal">
                            Enviado el {p.enviadoEn ? fechaCorta(p.enviadoEn) : ''}
                          </Estado>
                          {explorador ? (
                            <div>
                              <Enlace href={explorador} target="_blank" rel="noopener" gris>
                                Ver en Tronscan
                              </Enlace>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <Estado tono="llama">Por enviar</Estado>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Tabla>
          ) : null}
        </div>
      </div>
    </>
  );
}
