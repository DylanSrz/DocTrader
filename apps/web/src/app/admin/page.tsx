import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { GraficaVentas } from '@/components/admin/grafica-ventas';
import { Refrescar } from '@/components/panel/refrescar';
import { Seguridad } from '@/components/panel/seguridad';
import { Etiqueta, Pildora, cx } from '@/components/ui';
import type { Resumen } from '@/lib/admin';
import { llamarApi } from '@/lib/api';
import { usd } from '@/lib/formato';
import { requerirSesion, tokenDeSesion } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Administración' };

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const hora = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});
const dia = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Bogota',
});
const clave = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });

/** "Hoy 10:42", "Ayer 18:03", "8 oct". */
function cuando(fecha: string): string {
  const f = new Date(fecha);
  const hoy = clave.format(new Date());
  const ayer = clave.format(new Date(Date.now() - 86_400_000));
  if (clave.format(f) === hoy) return `Hoy ${hora.format(f)}`;
  if (clave.format(f) === ayer) return `Ayer ${hora.format(f)}`;
  return dia.format(f).replace('.', '');
}

async function Contenido() {
  const sesion = await requerirSesion('ADMIN');
  const respuesta = await llamarApi<Resumen>('/admin/resumen', { token: await tokenDeSesion() });
  if (!respuesta.ok) {
    return <p className="text-error">No pudimos cargar el resumen: {respuesta.error.mensaje}</p>;
  }
  const { pendientes, ventas, cuentas, actividad } = respuesta.datos;
  const total = pendientes.pagos + pendientes.porConectar + pendientes.porDesconectar;
  const mes = MESES[ventas.calendario.mes - 1] ?? '';
  const anterior = MESES[(ventas.calendario.mes + 10) % 12] ?? '';

  const montones = [
    {
      n: pendientes.pagos,
      texto: pendientes.pagos === 1 ? 'pago por revisar' : 'pagos por revisar',
      href: '/admin/pagos',
      ir: 'Ir a pagos',
    },
    {
      n: pendientes.porConectar,
      texto: pendientes.porConectar === 1 ? 'cuenta por conectar' : 'cuentas por conectar',
      href: '/admin/cuentas',
      ir: 'Ver datos',
    },
    {
      n: pendientes.porDesconectar,
      texto: pendientes.porDesconectar === 1 ? 'cuenta por desconectar' : 'cuentas por desconectar',
      href: '/admin/cuentas#por-desconectar',
      ir: 'Ver cuáles',
    },
    {
      n: pendientes.vencenEn7Dias,
      texto:
        pendientes.vencenEn7Dias === 1
          ? 'licencia vence esta semana'
          : 'licencias vencen esta semana',
      href: '/admin/licencias?filtro=vence',
      ir: 'Ver licencias',
    },
  ];

  return (
    <div className="grid gap-[clamp(96px,12vw,168px)]">
      <div>
        <div className="grid max-w-[980px] justify-items-start gap-[26px]">
          <Etiqueta>Hoy</Etiqueta>
          <h1 className="text-display">
            {total === 0
              ? 'Hoy no tienes pendientes.'
              : total === 1
                ? 'Hoy tienes 1 pendiente.'
                : `Hoy tienes ${total} pendientes.`}
          </h1>
          <p className="max-w-[34em] text-blanco">
            {pendientes.pagos > 0
              ? 'Empieza por los pagos: un cliente no puede conectarse hasta que apruebes el suyo.'
              : pendientes.porConectar > 0
                ? 'Hay cuentas que ya pagaron y esperan su conexión en Social Trader Tools.'
                : 'Todo al día. Aquí aparecen los pagos y las cuentas que requieren algo de ti.'}
          </p>
          {pendientes.pagos > 0 ? (
            <Pildora href="/admin/pagos">Revisar pagos</Pildora>
          ) : pendientes.porConectar > 0 ? (
            <Pildora href="/admin/cuentas">Conectar cuentas</Pildora>
          ) : null}
        </div>

        <ul
          aria-label="Pendientes"
          className="mt-[clamp(56px,7vw,96px)] grid grid-cols-4 gap-x-[clamp(24px,4vw,56px)] gap-y-10 max-lg:grid-cols-2"
        >
          {montones.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="group grid gap-1.5 rounded-xl">
                <strong
                  className={cx(
                    'cifra text-grande leading-[0.95] font-normal tracking-[-0.05em] transition-colors duration-200 group-hover:text-llama',
                    m.n === 0 && 'text-ceniza',
                  )}
                >
                  {m.n}
                </strong>
                <span className="text-niebla">{m.texto}</span>
                <small className="mt-2 justify-self-start text-sm text-ceniza underline decoration-white/30 underline-offset-[5px]">
                  {m.ir}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <section aria-labelledby="t-ventas" className="grid gap-[clamp(32px,4vw,48px)]">
        <h2 id="t-ventas" className="text-medio">
          Ventas de {mes}
        </h2>
        <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-12 max-lg:grid-cols-1">
          <div>
            <p className="cifra text-display leading-[0.95] tracking-[-0.05em]">
              {usd(ventas.mes.usdCentavos)}
            </p>
            <p className="mt-3 text-[15px] text-niebla">
              Ventas brutas aprobadas del 1 al {ventas.calendario.hoy} de {mes}:{' '}
              {ventas.mes.licencias === 1 ? '1 licencia' : `${ventas.mes.licencias} licencias`}.
            </p>
            <dl className="mt-7 grid grid-cols-3 justify-start gap-x-10 gap-y-2 max-sm:grid-cols-2">
              {[
                ['Hoy', ventas.hoyUsdCentavos],
                [
                  anterior.charAt(0).toUpperCase() + anterior.slice(1),
                  ventas.mesAnteriorUsdCentavos,
                ],
                [`En ${ventas.calendario.anio}`, ventas.anioUsdCentavos],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="grid gap-0.5">
                  <dt className="text-sm text-ceniza">{etiqueta}</dt>
                  <dd className="cifra text-2xl tracking-[-0.02em]">{usd(valor as number)}</dd>
                </div>
              ))}
            </dl>
            {ventas.porMoneda.length > 0 ? (
              <dl
                aria-label={`${mes} por moneda`}
                className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm"
              >
                {ventas.porMoneda.map((m) => (
                  <div key={m.moneda} className="flex gap-2">
                    <dt className="text-ceniza">{m.moneda}</dt>
                    <dd className="cifra">{usd(m.usdCentavos)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
          <GraficaVentas porDia={ventas.porDia} calendario={ventas.calendario} />
        </div>
        <dl className="mt-[clamp(24px,4vw,40px)] grid grid-cols-4 gap-8 max-lg:grid-cols-2">
          {[
            ['Cuentas conectadas', cuentas.conectadas],
            [`Nuevas en ${mes}`, cuentas.nuevasMes],
            [`Renovaciones en ${mes}`, cuentas.renovacionesMes],
            [
              'Clientes registrados',
              cuentas.clientes,
              `${cuentas.clientesVerificados} con el correo confirmado`,
            ],
          ].map(([etiqueta, valor, nota]) => (
            <div key={etiqueta as string} className="flex flex-col-reverse justify-end gap-1">
              <dt className="text-sm text-ceniza">
                {etiqueta}
                {nota ? <small className="block text-[13px]">{nota}</small> : null}
              </dt>
              <dd className="cifra text-[clamp(32px,3.4vw,48px)] leading-none tracking-[-0.04em]">
                {valor}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {actividad.length > 0 ? (
        <section aria-labelledby="t-actividad" className="grid gap-[clamp(32px,4vw,48px)]">
          <h2 id="t-actividad" className="text-medio">
            Actividad reciente
          </h2>
          <ol className="grid max-w-[900px] gap-[18px]">
            {actividad.map((a) => (
              <li
                key={`${a.fecha}-${a.texto}`}
                className="grid grid-cols-[7em_1fr] gap-5 max-sm:grid-cols-1 max-sm:gap-0.5"
              >
                <time dateTime={a.fecha} className="cifra pt-0.5 text-sm text-ceniza">
                  {cuando(a.fecha)}
                </time>
                <p className="text-niebla">{a.texto}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <Seguridad sesion={sesion} />
      {/* Los pagos y las cuentas cambian solos (worker, clientes): la portada se actualiza cada minuto. */}
      <Refrescar segundos={60} />
    </div>
  );
}

export default function Admin() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}
