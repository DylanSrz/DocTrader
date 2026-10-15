import { diasEntre } from '@doctrader/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Copiar } from '@/components/panel/copiar';
import { Enlace, Estado, Etiqueta } from '@/components/ui';
import type { CuentaDeTrabajo, ListasCuentas } from '@/lib/admin';
import { llamarApi } from '@/lib/api';
import { fechaCorta, fechaLarga } from '@/lib/formato';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';
import { Asignacion, Contrasenas, MarcarCuenta } from './acciones-cuenta';

export const metadata: Metadata = { title: 'Cuentas' };

/** "desde hoy", "desde ayer", "desde el 8 oct". */
function desde(fecha: string): string {
  const dias = diasEntre(new Date(fecha), new Date());
  if (dias <= 0) return 'desde hoy';
  if (dias === 1) return 'desde ayer';
  return `desde el ${fechaCorta(fecha).replace(/ \d{4}$/, '')}`;
}

function Dato({ etiqueta, valor, copiar }: { etiqueta: string; valor: string; copiar?: string }) {
  return (
    <>
      <dt className="text-ceniza">{etiqueta}</dt>
      <dd className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1">
        <span id={copiar} className="text-blanco [overflow-wrap:anywhere]" translate="no">
          {valor}
        </span>
        {copiar ? <Copiar texto={valor} idTexto={copiar} que={etiqueta} /> : null}
      </dd>
    </>
  );
}

function PorConectar({ cuenta, principal }: { cuenta: CuentaDeTrabajo; principal: boolean }) {
  const plan = cuenta.licencia.plan ?? 'Licencia';
  return (
    <li className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-8 max-md:grid-cols-1">
      <div className="grid justify-items-start gap-4">
        <Estado tono={cuenta.yaEstuvoConectada ? 'llama' : 'neutro'}>
          {cuenta.yaEstuvoConectada
            ? `Cambió sus datos ${desde(cuenta.desde)}`
            : `Por conectar ${desde(cuenta.desde)}`}
        </Estado>
        <h2 className="text-[clamp(28px,3vw,40px)] leading-[1.1] tracking-[-0.03em]">
          {cuenta.cliente.nombre}
        </h2>
        <p className="-mt-2 text-[15px] text-niebla">
          {plan}
          {cuenta.pago
            ? `, pagada el ${fechaCorta(cuenta.pago.fecha)} con ${cuenta.pago.moneda}`
            : ''}
          {cuenta.licencia.vence ? `. Vence el ${fechaCorta(cuenta.licencia.vence)}.` : ''}
        </p>
        {cuenta.yaEstuvoConectada ? (
          <p className="max-w-[30em] text-[15px] text-niebla">
            Ya estaba conectada: actualiza sus datos en Social Trader Tools (revisa las
            contraseñas).
          </p>
        ) : null}
        <div className="mt-2 w-full">
          <Asignacion
            cuenta={cuenta.id}
            capitalUsdCentavos={cuenta.capitalUsdCentavos}
            riesgo={cuenta.riesgo}
          />
        </div>
      </div>
      <div className="grid justify-items-start gap-6">
        <dl className="grid w-full grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] items-center gap-x-6 text-[15px]">
          <Dato etiqueta="Titular" valor={cuenta.titular} />
          <Dato etiqueta="Broker" valor={cuenta.broker} />
          <Dato etiqueta="Servidor" valor={cuenta.servidor} copiar={`servidor-${cuenta.id}`} />
          <Dato etiqueta="Número" valor={cuenta.numero} copiar={`numero-${cuenta.id}`} />
        </dl>
        <Contrasenas cuenta={cuenta.id} borradas={cuenta.contrasenasBorradas} />
        <MarcarCuenta
          cuenta={cuenta.id}
          numero={cuenta.numero}
          tipo="conectada"
          principal={principal}
        />
      </div>
    </li>
  );
}

function PorDesconectar({ cuenta }: { cuenta: CuentaDeTrabajo }) {
  const { licencia } = cuenta;
  const suspendida = licencia.estado === 'SUSPENDIDA';
  return (
    <li className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-6 max-md:grid-cols-1">
      <div className="grid justify-items-start gap-4">
        <Estado tono="error">{suspendida ? 'Suspendida' : 'Gracia terminada'}</Estado>
        <h3 className="text-[clamp(28px,3vw,40px)] leading-[1.1] tracking-[-0.03em]">
          {cuenta.cliente.nombre}
        </h3>
        <p className="-mt-2 text-[15px] text-niebla">
          Cuenta <span className="cifra">{cuenta.numero}</span>,{' '}
          <span translate="no">{cuenta.broker}</span>, servidor{' '}
          <span translate="no">{cuenta.servidor}</span>
        </p>
      </div>
      <div className="grid justify-items-start gap-5">
        <p className="max-w-[34em] text-[15px] text-niebla">
          {suspendida
            ? `La suspendimos${licencia.motivoSuspension ? `: ${licencia.motivoSuspension}` : '.'}`
            : `Su licencia ${(licencia.plan ?? '').toLowerCase()} venció el ${
                licencia.vence ? fechaLarga(licencia.vence) : '—'
              }${
                licencia.finGracia
                  ? ` y la gracia terminó el ${fechaLarga(licencia.finGracia)}`
                  : ''
              }. No ha renovado.`}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <MarcarCuenta
            cuenta={cuenta.id}
            numero={cuenta.numero}
            tipo="desconectada"
            principal={false}
          />
          <Enlace href={`mailto:${cuenta.cliente.correo}`} gris>
            Escribirle
          </Enlace>
        </div>
      </div>
    </li>
  );
}

async function Contenido() {
  await requerirSesion('ADMIN');
  const respuesta = await llamarApi<ListasCuentas>('/admin/cuentas', {
    token: await tokenDeSesion(),
  });
  if (!respuesta.ok) {
    return <p className="text-error">No pudimos cargar las cuentas: {respuesta.error.mensaje}</p>;
  }
  const { porConectar, porDesconectar, esperandoPago, conectadas } = respuesta.datos;
  const n = porConectar.length;
  return (
    <>
      <div className="grid max-w-[980px] justify-items-start gap-[26px]">
        <Etiqueta>Cuentas</Etiqueta>
        <h1 className="text-grande">
          {n === 0
            ? 'No hay cuentas por conectar.'
            : n === 1
              ? '1 cuenta por conectar en Social Trader Tools.'
              : `${n} cuentas por conectar en Social Trader Tools.`}
        </h1>
        <p className="max-w-[36em] text-blanco">
          Ya pagaron y sus datos están completos. Cuando termines de conectar una en Social Trader
          Tools, márcala aquí y el cliente recibe un correo.{' '}
          <span className="text-niebla">
            {conectadas === 1 ? 'Hay 1 cuenta conectada.' : `Hay ${conectadas} cuentas conectadas.`}
          </span>
        </p>
      </div>

      {n > 0 || esperandoPago.length > 0 ? (
        <section aria-label="Por conectar" className="mt-[clamp(56px,7vw,96px)]">
          <ol className="grid gap-[clamp(72px,9vw,120px)]">
            {porConectar.map((cuenta, i) => (
              <PorConectar key={cuenta.id} cuenta={cuenta} principal={i === 0} />
            ))}
            {esperandoPago.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-5 max-md:grid-cols-1"
              >
                <div className="grid justify-items-start gap-4">
                  <Estado tono="llama">Falta aprobar el pago</Estado>
                  <h2 className="text-[clamp(28px,3vw,40px)] leading-[1.1] tracking-[-0.03em]">
                    {e.cliente}
                  </h2>
                  <p className="-mt-2 text-[15px] text-niebla">
                    {e.plan}, cuenta <span className="cifra">{e.numero}</span>, pago reportado el{' '}
                    {fechaCorta(e.reportadaEn)} con {e.moneda}
                  </p>
                </div>
                <div className="grid justify-items-start gap-3">
                  <p className="max-w-[34em] text-[15px] text-niebla">
                    Sus datos están completos. Aparece lista para conectar apenas apruebes el pago{' '}
                    {e.orden}.
                  </p>
                  <Enlace href="/admin/pagos">Ir a aprobar el pago</Enlace>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="mt-10 max-w-[36em] text-niebla">
          Las cuentas aparecen aquí apenas apruebas su pago.
        </p>
      )}

      <section
        id="por-desconectar"
        aria-labelledby="t-desconectar"
        className="mt-[clamp(96px,12vw,168px)] scroll-mt-8"
      >
        <div className="mb-[clamp(32px,4vw,48px)] grid gap-3">
          <h2 id="t-desconectar" className="text-medio">
            Por desconectar
          </h2>
          <p className="max-w-[36em] text-niebla">
            Licencias vencidas a las que ya se les acabó la gracia, y licencias suspendidas.
          </p>
        </div>
        {porDesconectar.length > 0 ? (
          <ol className="grid gap-[clamp(56px,7vw,96px)]">
            {porDesconectar.map((cuenta) => (
              <PorDesconectar key={cuenta.id} cuenta={cuenta} />
            ))}
          </ol>
        ) : (
          <p className="text-niebla">No hay cuentas por desconectar.</p>
        )}
      </section>
    </>
  );
}

export default function CuentasAdmin() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando las cuentas…</p>}>
      <Contenido />
    </Suspense>
  );
}
