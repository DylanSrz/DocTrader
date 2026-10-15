import {
  DIAS_VENCE_PRONTO,
  diasEntre,
  diasRestantes,
  sumarMeses,
  ZONA_HORARIA,
} from '@doctrader/shared';
import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import { Calendario } from '@/components/panel/calendario';
import { FormularioCuenta, type PlanOpcion } from '@/components/panel/formulario-cuenta';
import { Lateral } from '@/components/panel/lateral';
import { BotonOrden, ElegirPlan } from '@/components/panel/ordenes';
import { Enlace, Estado, Pildora } from '@/components/ui';
import { dias, fechaLarga, NOMBRE_RIESGO, rangoFechas, usd } from '@/lib/formato';
import { type CuentaVista, leerPanel, type MisCuentas, type PlanVista } from '@/lib/panel';
import { obtenerLanding } from '@/lib/publico';
import { requerirSesion } from '@/lib/sesion';

export const metadata: Metadata = { title: 'Mis cuentas' };

const formatoHora = new Intl.DateTimeFormat('es-CO', {
  timeStyle: 'short',
  timeZone: ZONA_HORARIA,
});
/** "7:59 a. m" sin el punto final, para que la frase termine con uno solo. */
const hora = { format: (fecha: Date) => formatoHora.format(fecha).replace(/\.$/, '') };

/** "mensual por USD 120 o semestral por USD 499", con los planes a la venta. */
function listaPrecios(planes: PlanVista[]): string {
  const partes = planes.map((p) => `${p.nombre.toLowerCase()} por ${usd(p.precioUsdCentavos)}`);
  return partes.length > 1
    ? `${partes.slice(0, -1).join(', ')} o ${partes.at(-1)}`
    : (partes[0] ?? '');
}

function opcionesDePlanes(planes: PlanVista[]): PlanOpcion[] {
  return planes.map((p) => ({
    codigo: p.codigo,
    nombre: p.nombre,
    detalle:
      p.meses === 1
        ? '1 mes'
        : `${p.meses} meses${p.mesesObsequio ? ` + ${p.mesesObsequio} de obsequio` : ''}`,
    precio: String(p.precioUsdCentavos / 100),
  }));
}

/** El tramo de la licencia que se dibuja: los periodos que no han terminado (o el último, si ya venció). */
function tramo(cuenta: CuentaVista, ahora: Date) {
  const { licencia } = cuenta;
  if (!licencia.inicio || !licencia.fin) return null;
  const vigentes = licencia.periodos.filter((p) => new Date(p.fin) > ahora);
  const periodos = vigentes.length > 0 ? vigentes : licencia.periodos.slice(-1);
  const inicio = periodos.length
    ? new Date(Math.min(...periodos.map((p) => new Date(p.inicio).getTime())))
    : new Date(licencia.inicio);
  const fin = new Date(licencia.fin);
  const obsequios = periodos
    .filter((p) => p.mesesObsequio > 0)
    .map((p) => ({ desde: sumarMeses(new Date(p.fin), -p.mesesObsequio), hasta: new Date(p.fin) }));
  return {
    inicio,
    fin,
    obsequios,
    total: diasEntre(inicio, fin),
    quedan: diasRestantes(fin, ahora),
  };
}

function estadoDe(cuenta: CuentaVista, quedan: number | null) {
  const { licencia, conexion, ordenAbierta } = cuenta;
  switch (licencia.estado) {
    case 'SUSPENDIDA':
      return { tono: 'error', texto: 'Suspendida' } as const;
    case 'EN_GRACIA':
      return { tono: 'llama', texto: 'En gracia' } as const;
    case 'VENCIDA':
      return { tono: 'apagado', texto: 'Vencida' } as const;
    case 'PENDIENTE_PAGO':
      return ordenAbierta?.estado === 'REPORTADA'
        ? ({ tono: 'neutro', texto: 'Pago en revisión' } as const)
        : ({ tono: 'neutro', texto: 'Sin pagar' } as const);
    case 'ACTIVA':
      if (quedan !== null && quedan <= DIAS_VENCE_PRONTO)
        return { tono: 'llama', texto: 'Vence pronto' } as const;
  }
  if (conexion === 'CONECTADA') return { tono: 'senal', texto: 'Conectada' } as const;
  if (conexion === 'POR_DESCONECTAR') return { tono: 'apagado', texto: 'Por desconectar' } as const;
  return { tono: 'neutro', texto: 'Por conectar' } as const;
}

/** El titular de la vista: el dato más importante de todas las cuentas, con su única píldora. */
function Titular({
  cuentas,
  planes,
  ahora,
  nombre,
  nombreCompleto,
}: {
  cuentas: CuentaVista[];
  planes: PlanVista[];
  ahora: Date;
  nombre: string;
  nombreCompleto: string;
}) {
  let titulo: string;
  let texto: ReactNode;
  let accion: ReactNode = null;
  const opciones = opcionesDePlanes(planes);

  const enGracia = cuentas.filter((c) => c.licencia.estado === 'EN_GRACIA' && !c.ordenAbierta);
  const porVencer = cuentas
    .filter((c) => c.licencia.estado === 'ACTIVA' && c.licencia.fin && !c.ordenAbierta)
    .map((c) => ({ c, quedan: diasRestantes(new Date(c.licencia.fin!), ahora) }))
    .filter(({ quedan }) => quedan <= DIAS_VENCE_PRONTO)
    .sort((a, b) => a.quedan - b.quedan);
  const pendiente = cuentas.find((c) => c.ordenAbierta?.estado === 'PENDIENTE');
  const reportada = cuentas.find((c) => c.ordenAbierta?.estado === 'REPORTADA');
  const sinPagar = cuentas.find(
    (c) =>
      (c.licencia.estado === 'PENDIENTE_PAGO' || c.licencia.estado === 'VENCIDA') &&
      !c.ordenAbierta,
  );
  const porConectar = cuentas.find((c) => c.conexion === 'POR_CONECTAR');

  if (cuentas.length === 0) {
    titulo = `Hola, ${nombre}. Agrega tu primera cuenta de trading.`;
    texto = `Cada cuenta lleva su propia licencia: ${listaPrecios(planes)}.`;
    accion = (
      <Lateral titulo="Agregar cuenta de trading" boton="Agregar cuenta" variante="pildora">
        <FormularioCuenta planes={opciones} titularSugerido={nombreCompleto} />
      </Lateral>
    );
  } else if (enGracia[0]) {
    const c = enGracia[0];
    titulo =
      enGracia.length === 1 ? 'Una licencia venció.' : `${enGracia.length} licencias vencieron.`;
    texto = (
      <>
        La de la cuenta <span className="cifra">{c.numero}</span> está en sus días de gracia hasta
        el {fechaLarga(c.licencia.finGracia!)}. Renuévala para que siga conectada.
      </>
    );
    accion = c.licencia.plan ? (
      <BotonOrden cuentaId={c.id} plan={c.licencia.plan.codigo} variante="pildora">
        {`Renovar ${c.licencia.plan.nombre.toLowerCase()}`}
      </BotonOrden>
    ) : null;
  } else if (porVencer[0]) {
    const { c, quedan } = porVencer[0];
    titulo = quedan === 0 ? 'Una licencia vence hoy.' : `Una licencia vence en ${dias(quedan)}.`;
    texto = (
      <>
        La de la cuenta <span className="cifra">{c.numero}</span>. Renuévala antes del{' '}
        {fechaLarga(c.licencia.fin!)} para que siga conectada.
      </>
    );
    accion = c.licencia.plan ? (
      <BotonOrden cuentaId={c.id} plan={c.licencia.plan.codigo} variante="pildora">
        {`Renovar ${c.licencia.plan.nombre.toLowerCase()}`}
      </BotonOrden>
    ) : null;
  } else if (pendiente?.ordenAbierta) {
    titulo = 'Tienes un pago pendiente.';
    texto = (
      <>
        La orden {pendiente.ordenAbierta.numero} de la cuenta{' '}
        <span className="cifra">{pendiente.numero}</span> vale hasta las{' '}
        {hora.format(new Date(pendiente.ordenAbierta.expiraEn))}.
      </>
    );
    accion = (
      <Pildora href={`/panel/pagos?orden=${pendiente.ordenAbierta.numero}`}>Ir a pagar</Pildora>
    );
  } else if (reportada?.ordenAbierta) {
    titulo = 'Estamos revisando tu pago.';
    texto =
      'Verificamos la transacción en la blockchain y un administrador la aprueba. Te avisamos por correo.';
    accion = (
      <Enlace href={`/panel/pagos?orden=${reportada.ordenAbierta.numero}`}>Ver el pago</Enlace>
    );
  } else if (sinPagar) {
    titulo =
      sinPagar.licencia.estado === 'VENCIDA' ? 'Una licencia venció.' : 'Falta pagar la licencia.';
    texto = (
      <>
        La de la cuenta <span className="cifra">{sinPagar.numero}</span>. Elige el plan y paga en
        USDT o BTC.
      </>
    );
    accion = (
      <Lateral
        titulo={`Licencia para la cuenta ${sinPagar.numero}`}
        boton="Pagar licencia"
        variante="pildora"
      >
        <ElegirPlan cuentaId={sinPagar.id} planes={opciones} />
      </Lateral>
    );
  } else if (porConectar) {
    titulo = 'Tu cuenta está por conectar.';
    texto =
      'Recibimos tus datos y tu pago. Conectaremos la cuenta al copy trading y te avisaremos por correo.';
  } else {
    titulo = cuentas.length === 1 ? 'Tu cuenta está al día.' : 'Tus cuentas están al día.';
    const proxima = cuentas
      .map((c) => c.licencia.fin)
      .filter((f): f is string => Boolean(f))
      .sort()[0];
    texto = proxima ? `La próxima licencia vence el ${fechaLarga(proxima)}.` : null;
  }

  return (
    <div className="grid max-w-[980px] justify-items-start gap-[26px]">
      <h1 className={titulo.length > 40 ? 'text-grande' : 'text-display'}>{titulo}</h1>
      {texto ? <p className="max-w-[36em] text-blanco">{texto}</p> : null}
      {accion ? <div className="flex flex-wrap items-center gap-x-6 gap-y-3">{accion}</div> : null}
    </div>
  );
}

function Leyenda({ conObsequio }: { conObsequio: boolean }) {
  const items = [
    { texto: 'Día usado', fill: 'none', stroke: 'var(--color-ceniza)', opacidad: 0.45 },
    { texto: 'Día restante', fill: 'none', stroke: 'var(--color-llama)' },
    { texto: 'Hoy', fill: 'var(--color-llama)', stroke: 'var(--color-llama)' },
    // Solo las licencias viejas de 6 + 1 tienen mes de obsequio (la semestral es de 6 meses desde el 2026-10-15).
    ...(conObsequio
      ? [{ texto: 'Mes de obsequio', fill: 'none', stroke: 'var(--color-senal)' }]
      : []),
  ];
  return (
    <ul
      aria-label="Cómo leer el calendario"
      className="flex flex-wrap gap-x-[22px] gap-y-1.5 text-[13px] text-ceniza"
    >
      {items.map((item) => (
        <li key={item.texto} className="inline-flex items-center gap-2">
          <svg viewBox="0 0 10 9" aria-hidden="true" className="h-[9px] w-2.5">
            <path
              d="M5 1 9 8H1Z"
              fill={item.fill}
              stroke={item.stroke}
              strokeOpacity={item.opacidad}
            />
          </svg>
          {item.texto}
        </li>
      ))}
    </ul>
  );
}

function TarjetaCuenta({
  cuenta,
  planes,
  diasGracia,
  ahora,
}: {
  cuenta: CuentaVista;
  planes: PlanVista[];
  diasGracia: number;
  ahora: Date;
}) {
  const { licencia, ordenAbierta } = cuenta;
  const t = tramo(cuenta, ahora);
  const estado = estadoDe(cuenta, t?.quedan ?? null);
  const plan = licencia.plan;
  const opciones = opcionesDePlanes(planes);
  const pagable =
    !ordenAbierta && (licencia.estado === 'PENDIENTE_PAGO' || licencia.estado === 'VENCIDA');
  const renovable =
    !ordenAbierta && (licencia.estado === 'ACTIVA' || licencia.estado === 'EN_GRACIA');
  const sePuedeQuitar =
    (licencia.estado === 'PENDIENTE_PAGO' || licencia.estado === 'VENCIDA') &&
    (cuenta.conexion === 'SIN_LICENCIA' || cuenta.conexion === 'DESCONECTADA') &&
    ordenAbierta?.estado !== 'REPORTADA';
  const masLargos = plan ? planes.filter((p) => p.rango > plan.rango) : [];

  let nota: ReactNode = null;
  if (ordenAbierta?.estado === 'REPORTADA') {
    nota = `Reportaste el pago de la orden ${ordenAbierta.numero}. Lo estamos revisando; te avisamos por correo.`;
  } else if (ordenAbierta) {
    nota = `Tienes la orden ${ordenAbierta.numero} sin pagar. Vale hasta las ${hora.format(new Date(ordenAbierta.expiraEn))}.`;
  } else if (licencia.estado === 'PENDIENTE_PAGO') {
    nota =
      'Paga la licencia para que conectemos la cuenta. Empieza a contar el día que aprobamos el pago.';
  } else if (licencia.estado === 'VENCIDA') {
    nota = `La licencia venció el ${fechaLarga(licencia.fin!)}. Para volver a conectar la cuenta, compra una licencia nueva.`;
  } else if (licencia.estado === 'EN_GRACIA') {
    nota = `Venció el ${fechaLarga(licencia.fin!)}. Renuévala antes del ${fechaLarga(licencia.finGracia!)} para que no la desconectemos.`;
  } else if (licencia.estado === 'SUSPENDIDA') {
    nota = 'La licencia está suspendida. Abre un ticket en Soporte si tienes dudas.';
  } else if (cuenta.conexion === 'POR_CONECTAR') {
    nota = 'Recibimos tus datos. Conectaremos la cuenta y te avisaremos por correo.';
  } else if (licencia.estado === 'ACTIVA' && t && t.quedan <= DIAS_VENCE_PRONTO) {
    nota = `Si vence, tienes ${dias(diasGracia)} de gracia con la cuenta conectada.`;
  }

  return (
    <li className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-x-[clamp(32px,6vw,96px)] gap-y-8 max-md:grid-cols-1">
      <div className="grid justify-items-start gap-[18px]">
        <Estado tono={estado.tono}>{estado.texto}</Estado>
        <h3 className="cifra text-[clamp(32px,3.4vw,42px)] leading-[1.1] tracking-[-0.04em]">
          <span className="sr-only">Cuenta </span>
          {cuenta.numero}
        </h3>
        <p className="-mt-3 text-[15px] text-ceniza">
          <span translate="no">{cuenta.broker}</span>, servidor {cuenta.servidor}
        </p>
        <dl className="mt-2.5 grid grid-cols-[auto_auto] justify-start gap-x-6 gap-y-1.5 text-[15px]">
          <dt className="text-ceniza">Licencia</dt>
          <dd>
            {plan && licencia.inicio && licencia.fin
              ? `${plan.nombre}, ${rangoFechas(t?.inicio.toISOString() ?? licencia.inicio, licencia.fin)}`
              : 'Sin pagar'}
          </dd>
          {cuenta.capitalRecomendadoUsdCentavos ? (
            <>
              <dt className="text-ceniza">Capital recomendado</dt>
              <dd className="cifra">{usd(cuenta.capitalRecomendadoUsdCentavos)}</dd>
            </>
          ) : null}
          {cuenta.riesgo ? (
            <>
              <dt className="text-ceniza">Nivel de riesgo</dt>
              <dd>{NOMBRE_RIESGO[cuenta.riesgo]}</dd>
            </>
          ) : null}
          <dt className="text-ceniza">Titular</dt>
          <dd>{cuenta.titular}</dd>
        </dl>
      </div>

      <div className="grid justify-items-start gap-[22px]">
        {t ? (
          <>
            <p className="flex flex-wrap items-baseline gap-4">
              <strong
                className={`cifra text-grande leading-[0.9] font-normal tracking-[-0.05em] ${
                  estado.tono === 'llama' ? 'text-llama' : ''
                }`}
              >
                {t.quedan}
              </strong>
              <span className="text-[15px] text-niebla">
                {t.quedan === 1 ? 'día restante' : 'días restantes'} de {t.total}
              </span>
            </p>
            <Calendario
              inicio={t.inicio}
              fin={t.fin}
              obsequios={t.obsequios}
              etiqueta={`Licencia ${plan?.nombre.toLowerCase() ?? ''}: quedan ${dias(t.quedan)} de ${t.total}${
                t.obsequios.length ? '; el último mes es de obsequio' : ''
              }.`}
            />
          </>
        ) : null}
        {nota ? <p className="max-w-[32em] text-[15px] text-niebla">{nota}</p> : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {ordenAbierta ? (
            <Enlace href={`/panel/pagos?orden=${ordenAbierta.numero}`}>
              {ordenAbierta.estado === 'REPORTADA' ? 'Ver el pago' : 'Ir a pagar'}
            </Enlace>
          ) : null}
          {pagable ? (
            <Lateral titulo={`Licencia para la cuenta ${cuenta.numero}`} boton="Pagar licencia">
              <ElegirPlan cuentaId={cuenta.id} planes={opciones} />
            </Lateral>
          ) : null}
          {renovable && plan ? (
            <BotonOrden cuentaId={cuenta.id} plan={plan.codigo}>
              Renovar
            </BotonOrden>
          ) : null}
          {renovable
            ? masLargos.map((p) => (
                <BotonOrden key={p.codigo} cuentaId={cuenta.id} plan={p.codigo}>
                  {`Pasar a ${p.nombre.toLowerCase()}`}
                </BotonOrden>
              ))
            : null}
          <Lateral titulo={`Editar cuenta ${cuenta.numero}`} boton="Editar datos" gris>
            <FormularioCuenta
              cuenta={{
                id: cuenta.id,
                titular: cuenta.titular,
                broker: cuenta.broker,
                servidor: cuenta.servidor,
                numero: cuenta.numero,
              }}
              sePuedeQuitar={sePuedeQuitar}
            />
          </Lateral>
        </div>
      </div>
    </li>
  );
}

async function Contenido() {
  const sesion = await requerirSesion('CLIENT');
  const [{ cuentas, planes, diasGracia }, landing] = await Promise.all([
    leerPanel<MisCuentas>('/cuentas'),
    obtenerLanding(),
  ]);
  const ahora = new Date();
  const nombre = sesion.usuario.nombre.split(' ')[0] ?? sesion.usuario.nombre;
  const opciones = opcionesDePlanes(planes);

  return (
    <>
      <Titular
        cuentas={cuentas}
        planes={planes}
        ahora={ahora}
        nombre={nombre}
        nombreCompleto={sesion.usuario.nombre}
      />

      {cuentas.length > 0 ? (
        <section aria-labelledby="t-lista" className="mt-[clamp(96px,12vw,168px)]">
          <div className="mb-[clamp(40px,5vw,64px)] flex flex-wrap items-baseline justify-between gap-x-8 gap-y-4">
            <h2 id="t-lista" className="text-medio">
              {cuentas.length === 1
                ? 'Tu cuenta y su licencia'
                : `${cuentas.length} cuentas, una licencia cada una`}
            </h2>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {cuentas.some((c) => c.licencia.inicio) ? (
                <Leyenda
                  conObsequio={cuentas.some((c) =>
                    c.licencia.periodos.some((p) => p.mesesObsequio > 0),
                  )}
                />
              ) : null}
              <Lateral titulo="Agregar cuenta de trading" boton="Agregar cuenta">
                <FormularioCuenta planes={opciones} titularSugerido={sesion.usuario.nombre} />
              </Lateral>
            </div>
          </div>
          <ol aria-label="Cuentas de trading" className="grid gap-[clamp(88px,10vw,140px)]">
            {cuentas.map((cuenta) => (
              <TarjetaCuenta
                key={cuenta.id}
                cuenta={cuenta}
                planes={planes}
                diasGracia={diasGracia}
                ahora={ahora}
              />
            ))}
          </ol>
        </section>
      ) : null}

      <div className="mt-[clamp(96px,12vw,168px)] grid grid-cols-2 gap-x-[clamp(32px,6vw,96px)] gap-y-16 max-md:grid-cols-1">
        {cuentas.length > 0 ? (
          <section
            aria-labelledby="t-otra"
            className="grid content-start justify-items-start gap-[18px]"
          >
            <h2 id="t-otra" className="text-medio">
              ¿Quieres conectar otra cuenta?
            </h2>
            <p className="max-w-[36em] text-niebla">
              Cada cuenta de trading lleva su propia licencia: {listaPrecios(planes)}.
            </p>
          </section>
        ) : null}
        <section
          aria-labelledby="t-ayuda"
          className="grid content-start justify-items-start gap-[18px]"
        >
          <h2 id="t-ayuda" className="text-medio">
            ¿Necesitas ayuda?
          </h2>
          <p className="max-w-[36em] text-niebla">
            Abre un ticket y te respondemos aquí y por correo. Para dudas rápidas, escríbenos por{' '}
            <span translate="no">Telegram</span>.
          </p>
          <div className="flex flex-wrap items-center gap-x-6">
            <Enlace href="/panel/soporte?nuevo=1">Abrir un ticket</Enlace>
            <Enlace href={landing.enlaces.telegram} target="_blank" rel="noopener" gris>
              Escribir por&nbsp;<span translate="no">Telegram</span>
            </Enlace>
          </div>
        </section>
      </div>
    </>
  );
}

export default function MisCuentasPagina() {
  return (
    <Suspense fallback={<p className="text-ceniza">Cargando tus cuentas…</p>}>
      <Contenido />
    </Suspense>
  );
}
