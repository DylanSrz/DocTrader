import { formatearPorcentaje } from '@doctrader/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CifraAnimada } from '@/components/landing/cifra-animada';
import { CopiarCorreo } from '@/components/landing/copiar-correo';
import { BarraFlotante } from '@/components/barra-flotante';
import { EnlacePanel } from '@/components/landing/enlace-panel';
import { FranjaLogos } from '@/components/landing/franja-logos';
import { Particulas } from '@/components/landing/particulas';
import { Marca } from '@/components/marca';
import { MenuMovil } from '@/components/menu-movil';
import { NavSecciones } from '@/components/landing/nav-secciones';
import { Enlace, Etiqueta, Pildora, cx } from '@/components/ui';
import { markdownAHtml } from '@/lib/markdown';
import { planesEnVenta } from '@/lib/planes';
import { type Landing, obtenerLanding, type PlanPublico } from '@/lib/publico';

export const metadata: Metadata = {
  title: { absolute: 'DocTraderPRO · Licencia de software de copy trading' },
  description:
    'Doc Trader Pro AI replica en tu cuenta cada operación del sistema DocTrader Pro, en el broker que tú elijas. Tu dinero nunca sale de tu cuenta y el historial lo audita Myfxbook.',
  // Dirección oficial para los buscadores (con www, de metadataBase): sin www o con parámetros cuenta como esta.
  alternates: { canonical: '/' },
};

/*
  Landing de la propuesta 2 (design/propuesta-2/landing): negro puro, sin tarjetas ni bordes, la jerarquía la dan el
  tamaño y el espacio. Una sola píldora naranja por sección. Planes, precios, preguntas, cifras y enlaces vienen de
  la base de datos (con caché); los textos de las secciones son fijos.
*/

const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const fechaLarga = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const dolares = (centavos: number) => numero.format(centavos / 100);
/** Decimales con que se muestra una cifra de Myfxbook ("246.680" → 2, "12.5" → 1), como `numero`. */
const decimalesDe = (cifra: string) =>
  Math.min(cifra.split('.')[1]?.replace(/0+$/, '').length ?? 0, 2);
const NoTraducir = ({ children }: { children: ReactNode }) => (
  <span translate="no">{children}</span>
);

export default async function Inicio() {
  const datos = await obtenerLanding();
  return (
    <>
      <a
        href="#contenido"
        className="absolute top-3 left-[var(--spacing-margen)] z-50 -translate-y-[200%] rounded-pildora bg-senal px-4 py-2.5 text-sm font-semibold text-vacio transition-transform focus-visible:translate-y-0"
      >
        Saltar al contenido
      </a>
      <Barra />
      <main id="contenido" tabIndex={-1}>
        <Hero />
        <Problema />
        <ComoFunciona broker={datos.enlaces.broker} />
        <Resultados myfxbook={datos.myfxbook} />
        <Precios planes={datos.planes} referidos={datos.referidos} />
        <Preguntas preguntas={datos.preguntas} telegram={datos.enlaces.telegram} />
        <Cierre />
      </main>
      <Pie datos={datos} />
      <DatosEstructurados datos={datos} />
    </>
  );
}

const SECCIONES = [
  ['#como-funciona', 'Cómo funciona'],
  ['#precios', 'Precios'],
  ['#preguntas', 'Preguntas'],
] as const;

function Barra() {
  return (
    <BarraFlotante className="flex items-center justify-between gap-4 pr-2 pl-5 sm:pl-6">
      <Marca />
      <div className="flex items-center gap-[clamp(8px,1.6vw,20px)]">
        {/* Escritorio: las secciones e "Ingresar" en la píldora. Celular y tablet: en el menú de tres líneas. */}
        <nav aria-label="Principal" className="hidden items-center gap-1 min-[961px]:flex">
          <NavSecciones secciones={SECCIONES} />
          <EnlacePanel className="enlace-barra" />
        </nav>
        <Pildora href="#precios" className="min-h-10 px-[18px] py-2.5 sm:px-[22px]">
          {/* Un solo bloque de texto: el espacio entre las palabras no depende del `gap` de la píldora. */}
          <span>
            Comprar<span className="hidden sm:inline"> licencia</span>
          </span>
        </Pildora>
        <MenuMovil etiqueta="Menú principal" cabecera={<Marca />} className="min-[961px]:hidden">
          <nav aria-label="Principal">
            <ul className="grid gap-1">
              {SECCIONES.map(([href, texto]) => (
                <li key={href}>
                  <a href={href} className="enlace-menu">
                    {texto}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid justify-items-start gap-4 border-t border-white/10 pt-6">
            <EnlacePanel className="inline-flex min-h-11 items-center text-[17px] text-blanco underline decoration-white/35 underline-offset-[6px]" />
            <Pildora href="#precios">Comprar licencia</Pildora>
          </div>
        </MenuMovil>
      </div>
    </BarraFlotante>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="t-hero"
      className="contenedor grid items-center gap-[clamp(24px,4vw,64px)] pt-8 pb-12 min-[961px]:min-h-[min(860px,calc(100svh-90px))] min-[961px]:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] min-[961px]:pt-6"
    >
      <div className="grid justify-items-start gap-[30px]">
        <Etiqueta>Licencia de software de copy trading</Etiqueta>
        <h1 id="t-hero" className="text-display">
          Tu cuenta, conectada al sistema DocTrader Pro.
        </h1>
        <p className="max-w-[34em] text-blanco">
          <NoTraducir>Doc Trader Pro AI</NoTraducir> replica en tu cuenta cada operación del
          sistema, en el broker que tú elijas. Tu dinero nunca sale de tu cuenta y el historial del
          sistema lo audita <NoTraducir>Myfxbook</NoTraducir>.
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <Pildora href="#precios">Comprar licencia</Pildora>
          <a
            href="#como-funciona"
            className="inline-flex min-h-11 items-center text-sm text-blanco underline decoration-white/35 underline-offset-[6px] hover:decoration-current"
          >
            Ver cómo funciona
          </a>
        </div>
      </div>
      <div className="relative -order-1 aspect-[255/305] w-[min(64vw,360px)] justify-self-center min-[961px]:order-none min-[961px]:max-h-[78svh] min-[961px]:w-full">
        <Particulas
          logo
          sueltas={70}
          puntero
          etiqueta="El logo de DocTraderPRO, un cerebro con barras y una flecha que sube, formado por partículas"
          className="absolute -inset-[12%] block h-[124%] w-[124%]"
        />
      </div>
    </section>
  );
}

/** Dos columnas: el titular (fijo al hacer scroll en escritorio) y el contenido. */
function DosColumnas({
  cabeza,
  fija = false,
  children,
  className,
}: {
  cabeza: ReactNode;
  fija?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'grid items-start gap-[clamp(32px,6vw,96px)] min-[961px]:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]',
        className,
      )}
    >
      <div
        className={cx('grid content-start gap-6', fija && 'min-[961px]:sticky min-[961px]:top-12')}
      >
        {cabeza}
      </div>
      {children}
    </div>
  );
}

/** Sección de la landing. Su titular lleva el id `t-<id>`. */
function Seccion({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`t-${id}`} className="contenedor pt-[var(--spacing-seccion)]">
      {children}
    </section>
  );
}

function Problema() {
  const problemas = [
    {
      titulo: 'No puedes estar frente a la pantalla todo el día.',
      texto:
        'El mercado se mueve de domingo a viernes, a cualquier hora. Las entradas no esperan a que salgas del trabajo.',
    },
    {
      titulo: 'Las emociones deciden por ti.',
      texto:
        'El miedo cierra antes de tiempo y la esperanza deja correr las pérdidas. Un sistema sigue sus reglas siempre.',
    },
    {
      titulo: 'Las señales no se pueden comprobar.',
      texto: (
        <>
          Un grupo de mensajes o una captura de pantalla no muestran el historial completo. El de
          este sistema lo audita <NoTraducir>Myfxbook</NoTraducir>.
        </>
      ),
    },
  ];
  return (
    <Seccion id="problema">
      <DosColumnas
        fija
        cabeza={
          <h2 id="t-problema" className="text-grande">
            Operar a mano cuesta más que tiempo.
          </h2>
        }
      >
        <ul className="grid gap-[clamp(48px,6vw,84px)] pt-2">
          {problemas.map((p) => (
            <li key={p.titulo} className="grid gap-3.5">
              <h3 className="text-medio">{p.titulo}</h3>
              <p className="max-w-[34em] text-niebla">{p.texto}</p>
            </li>
          ))}
        </ul>
      </DosColumnas>
    </Seccion>
  );
}

function ComoFunciona({ broker }: { broker: Landing['enlaces']['broker'] }) {
  const pasos = [
    {
      titulo: 'Crea tu cuenta',
      texto: 'Con tu nombre, cédula, correo y teléfono. Toma menos de un minuto.',
    },
    {
      titulo: 'Agrega tu cuenta de trading',
      texto: 'Broker, servidor, número de cuenta y contraseñas. Las guardamos cifradas.',
      extra: (
        <a
          href={broker.url}
          target="_blank"
          rel="noopener sponsored"
          className="inline-flex min-h-11 items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco hover:decoration-current"
        >
          ¿No sabes qué broker elegir? Te sugerimos&nbsp;<NoTraducir>{broker.name}</NoTraducir>
        </a>
      ),
    },
    {
      titulo: 'Paga la licencia en cripto',
      texto: 'Con USDT o Bitcoin. Revisamos tu pago directamente en la blockchain.',
    },
    {
      titulo: 'Conectamos tu cuenta',
      texto:
        'Te avisamos por correo cuando quede conectada. Desde ahí, cada operación del sistema se replica en tu cuenta.',
      extra: (
        <span className="inline-flex items-center gap-2.5 rounded-pildora bg-senal/12 px-3.5 py-2 text-sm font-medium text-senal">
          <span aria-hidden="true" className="punto-vivo" />
          Cuenta conectada
        </span>
      ),
    },
  ];
  return (
    <Seccion id="como-funciona">
      <h2 id="t-como-funciona" className="max-w-[760px] text-grande">
        Cuatro pasos y tu cuenta queda conectada.
      </h2>
      {/* Al bajar, cada cifra se llena con el degradado del logo de abajo hacia arriba, como sus barras (ver `.paso`). */}
      <ol className="mt-[clamp(56px,8vw,112px)] grid gap-[clamp(72px,10vw,136px)]">
        {pasos.map((paso, i) => (
          <li
            key={paso.titulo}
            className="paso group grid items-center gap-4 min-[961px]:grid-cols-2 min-[961px]:gap-[clamp(24px,6vw,96px)]"
          >
            <span
              aria-hidden="true"
              data-cifra={i + 1}
              className="paso-cifra cifra text-[clamp(96px,16vw,220px)] leading-[0.81] font-light tracking-[-0.06em] min-[961px]:group-even:order-2 min-[961px]:group-even:justify-self-end"
            >
              {i + 1}
            </span>
            <div className="grid justify-items-start gap-4">
              <p className="texto-menu text-llama">
                Paso {i + 1} de {pasos.length}
              </p>
              <h3 className="text-medio">{paso.titulo}</h3>
              <span aria-hidden="true" className="paso-linea" />
              <p className="max-w-[34em] text-niebla">{paso.texto}</p>
              {paso.extra}
            </div>
          </li>
        ))}
      </ol>
    </Seccion>
  );
}

function Resultados({ myfxbook }: { myfxbook: Landing['myfxbook'] }) {
  const { gainPercent, maxDrawdownPercent, auditedSince, asOf } = myfxbook.figures;
  // Años auditados a la fecha de las cifras (no a hoy: la página se arma una vez y queda en caché).
  const anios =
    auditedSince && asOf
      ? Math.floor(
          (new Date(asOf).getTime() - new Date(auditedSince).getTime()) /
            (365.25 * 24 * 3600 * 1000),
        )
      : null;
  const cifras = [
    {
      etiqueta: 'Ganancia total',
      nombre: 'la ganancia total',
      valor: gainPercent ? (
        <CifraAnimada
          valor={Number(gainPercent)}
          decimales={decimalesDe(gainPercent)}
          prefijo="+"
          sufijo=" %"
        />
      ) : null,
    },
    {
      etiqueta: 'Caída máxima',
      nombre: 'la caída máxima',
      valor: maxDrawdownPercent ? (
        <CifraAnimada
          valor={Number(maxDrawdownPercent)}
          decimales={decimalesDe(maxDrawdownPercent)}
          sufijo=" %"
        />
      ) : null,
    },
    {
      etiqueta: 'Tiempo auditado',
      nombre: 'el tiempo auditado',
      valor:
        anios !== null ? (
          <CifraAnimada valor={anios} sufijo={anios === 1 ? ' año' : ' años'} />
        ) : null,
    },
  ];
  // "La caída máxima y el tiempo auditado vuelven cuando el historial esté completo."
  const faltan = cifras.filter((c) => !c.valor).map((c) => c.nombre);
  const pendientes =
    faltan.length > 0
      ? ` ${faltan.join(' y ').replace(/^./, (l) => l.toUpperCase())} ${faltan.length > 1 ? 'vuelven' : 'vuelve'} cuando el historial esté completo.`
      : '';
  return (
    <Seccion id="resultados">
      <DosColumnas
        cabeza={
          <h2 id="t-resultados" className="text-grande">
            Resultados que puedes revisar tú mismo.
          </h2>
        }
      >
        <p className="max-w-[34em] pt-2.5 text-niebla">
          <NoTraducir>Myfxbook</NoTraducir> es un verificador independiente: lee el historial
          directamente del broker, así que nadie puede editarlo. Antes de comprar, revisa cada
          operación.
        </p>
      </DosColumnas>
      <dl className="mt-[clamp(56px,7vw,96px)] grid gap-9 min-[961px]:grid-cols-3 min-[961px]:gap-8">
        {cifras
          .filter((c) => c.valor)
          .map((c) => (
            <div key={c.etiqueta} className="flex flex-col-reverse gap-2.5">
              <dt className="text-sm text-ceniza">{c.etiqueta}</dt>
              <dd className="cifra text-grande">{c.valor}</dd>
            </div>
          ))}
      </dl>
      <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-2">
        {asOf ? (
          <p className="inline-flex items-center gap-2.5 text-sm text-senal before:size-[7px] before:rounded-full before:bg-current">
            Cifras de la cuenta de DocTrader Pro al {fechaLarga.format(new Date(asOf))}.{pendientes}
          </p>
        ) : null}
        <Enlace href={myfxbook.url} target="_blank" rel="noopener" gris>
          Ver la cuenta en&nbsp;<NoTraducir>Myfxbook</NoTraducir>
        </Enlace>
      </div>
      <p className="mt-3 text-sm text-ceniza">
        Los resultados pasados no garantizan resultados futuros.
      </p>

      <div className="mt-[clamp(72px,9vw,128px)] grid gap-[22px]">
        <h3 className="text-sm text-ceniza">Con qué funciona</h3>
        <FranjaLogos />
      </div>
    </Seccion>
  );
}

function ventajas(plan: PlanPublico, siguientes: PlanPublico[]): string[] {
  const comunes = ['Una cuenta de trading conectada', 'Soporte con tickets y por Telegram'];
  const cambio =
    siguientes.length > 0
      ? `Puedes pasarla a ${siguientes.map((p) => p.nombre.toLowerCase()).join(' o ')} antes de que venza`
      : null;
  const porMes =
    plan.dolaresPorMes !== null && plan.meses !== null && plan.meses + plan.mesesObsequio > 1
      ? `Equivale a USD ${plan.dolaresPorMes} al mes`
      : null;
  const obsequio =
    plan.mesesObsequio > 0
      ? `${plan.meses} meses pagados + ${plan.mesesObsequio} de obsequio`
      : null;
  return [
    ...(obsequio ? [obsequio] : []),
    ...(porMes ? [porMes] : ['Para empezar sin comprometerte']),
    ...comunes,
    ...(cambio && !obsequio ? [cambio] : []),
  ];
}

function Precios({
  planes,
  referidos,
}: {
  planes: PlanPublico[];
  referidos: Landing['referidos'];
}) {
  const { publicos, ahorroDe, recomendado } = planesEnVenta(planes);
  return (
    <Seccion id="precios">
      <DosColumnas
        cabeza={
          <h2 id="t-precios" className="text-grande">
            Una licencia por cuenta de trading.
          </h2>
        }
      >
        <p className="max-w-[34em] pt-2.5 text-niebla">
          Pagas una vez por periodo, sin renovación automática. Te avisamos antes de que venza para
          que decidas si renuevas.
        </p>
      </DosColumnas>

      <div
        className={cx(
          'mt-[clamp(56px,7vw,96px)] grid gap-[clamp(40px,5vw,80px)]',
          // Dos planes ocupan dos columnas (sin la tercera vacía); tres, las tres.
          publicos.length >= 3
            ? 'min-[961px]:grid-cols-3'
            : 'max-w-[980px] min-[961px]:grid-cols-2',
        )}
      >
        {publicos.map((plan, i) => {
          const meses = (plan.meses ?? 0) + plan.mesesObsequio;
          const ahorro = ahorroDe(plan);
          // La ruta decide según la sesión: panel con la compra abierta, ingresar o registro.
          const ruta = `/comprar/${plan.codigo.toLowerCase()}`;
          return (
            <article
              key={plan.codigo}
              aria-labelledby={`t-plan-${plan.codigo}`}
              // Columna flexible: el botón queda abajo, alineado entre planes con distinto número de ventajas.
              className="flex flex-col items-start gap-[22px]"
            >
              <div className="flex min-h-8 flex-wrap items-center gap-3.5">
                <h3 id={`t-plan-${plan.codigo}`} className="text-2xl tracking-[-0.02em]">
                  {plan.nombre}
                </h3>
                {plan.mesesObsequio > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-senal/12 px-3 py-1.5 text-[13px] font-medium text-senal">
                    {plan.mesesObsequio === 1 ? '1 mes' : `${plan.mesesObsequio} meses`} de obsequio
                  </span>
                ) : null}
                {plan === recomendado ? (
                  <span className="inline-flex items-center rounded-full bg-llama px-3 py-1.5 text-[13px] font-semibold text-vacio">
                    Recomendado
                  </span>
                ) : null}
                {ahorro > 0 ? (
                  <span className="inline-flex items-center rounded-full bg-llama/14 px-3 py-1.5 text-[13px] font-medium text-llama-viva">
                    Ahorras USD {dolares(ahorro)}
                  </span>
                ) : null}
              </div>
              <p className="flex items-baseline gap-3.5">
                <strong className="cifra text-[clamp(56px,6.4vw,96px)] leading-[0.9] font-normal tracking-[-0.05em]">
                  {dolares(plan.precioUsdCentavos)}
                </strong>
                <span className="text-cuerpo text-ceniza">
                  USD por {meses}&nbsp;{meses === 1 ? 'mes' : 'meses'}
                </span>
              </p>
              <ul className="grid gap-2 text-niebla">
                {ventajas(plan, publicos.slice(i + 1)).map((texto) => (
                  <li key={texto} className="vineta-rombo flex items-baseline gap-3">
                    <span>{texto}</span>
                  </li>
                ))}
              </ul>
              <Pildora href={ruta} nativo className="mt-auto">
                Comprar {plan.nombre.toLowerCase()}
              </Pildora>
            </article>
          );
        })}
      </div>

      <p className="mt-7 text-sm text-ceniza">Pagas con USDT (Tron) o Bitcoin. Sin devoluciones.</p>

      {referidos.activo ? (
        <p className="mt-[clamp(40px,5vw,64px)] flex max-w-[980px] flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/8 pt-7 text-niebla">
          <span>
            <span className="text-blanco">
              Recomienda y gana el {formatearPorcentaje(referidos.porcentajeBp)}
            </span>{' '}
            de cada licencia que paguen las personas que invites, en USDT cada quincena.
          </span>
          <Enlace href="/panel/referidos" nativo>
            Ver mi enlace de invitación
          </Enlace>
        </p>
      ) : null}
    </Seccion>
  );
}

function Preguntas({ preguntas, telegram }: { preguntas: Landing['preguntas']; telegram: string }) {
  return (
    <Seccion id="preguntas">
      <DosColumnas
        fija
        cabeza={
          <>
            <h2 id="t-preguntas" className="text-grande">
              Preguntas frecuentes.
            </h2>
            <p className="text-niebla">
              ¿No encuentras la tuya?{' '}
              <Enlace href={telegram} target="_blank" rel="noopener">
                Escríbenos por&nbsp;<NoTraducir>Telegram</NoTraducir>
              </Enlace>
            </p>
          </>
        }
      >
        <div className="grid">
          {preguntas.map((p) => (
            <details key={p.pregunta} name="faq" className="pregunta py-[22px]">
              <summary className="grid min-h-11 cursor-pointer grid-cols-[minmax(0,1fr)_24px] items-center gap-6 text-xl leading-[1.25] tracking-[-0.02em] sm:text-2xl">
                {p.pregunta}
                <span className="cruz" aria-hidden="true" />
              </summary>
              <div
                className="respuesta grid max-w-[40em] gap-3 pt-3.5 text-niebla sm:pr-12"
                // Markdown del panel de admin, convertido sin HTML (ver lib/markdown.ts).
                dangerouslySetInnerHTML={{ __html: markdownAHtml(p.respuesta) }}
              />
            </details>
          ))}
        </div>
      </DosColumnas>
    </Seccion>
  );
}

function Cierre() {
  return (
    <section
      aria-labelledby="t-cierre"
      className="relative mt-[var(--spacing-seccion)] overflow-hidden py-[clamp(120px,16vw,220px)]"
    >
      <Particulas
        sueltas={{ celular: 60, escritorio: 140 }}
        className="pointer-events-none absolute inset-0 block size-full"
      />
      <div className="contenedor relative grid justify-items-start gap-[30px]">
        <h2 id="t-cierre" className="text-display">
          Empieza con una cuenta.
        </h2>
        <p className="text-blanco">Elige tu licencia y en minutos tienes tu orden de pago lista.</p>
        <Pildora href="#precios">Comprar licencia</Pildora>
      </div>
    </section>
  );
}

function Pie({ datos }: { datos: Landing }) {
  const claseEnlace = 'inline-flex min-h-11 items-center transition-colors hover:text-blanco';
  return (
    <footer className="pt-12 pb-[calc(40px+env(safe-area-inset-bottom,0px))] text-sm text-ceniza">
      <div className="contenedor">
        <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-6">
          <ul className="flex flex-wrap items-center gap-x-7 gap-y-1">
            <li>
              <a
                className={claseEnlace}
                href={datos.enlaces.telegram}
                target="_blank"
                rel="noopener"
              >
                <NoTraducir>Telegram</NoTraducir>
              </a>
            </li>
            <li>
              <a
                className={claseEnlace}
                href={datos.enlaces.instagram}
                target="_blank"
                rel="noopener"
              >
                <NoTraducir>Instagram</NoTraducir>
              </a>
            </li>
            <li>
              <EnlacePanel className={claseEnlace} />
            </li>
            <li>
              <CopiarCorreo correo={datos.correoSoporte} />
            </li>
          </ul>
          <ul className="flex flex-wrap gap-x-7 gap-y-1">
            <li>
              <Link className={claseEnlace} href="/legal/terminos">
                Términos
              </Link>
            </li>
            <li>
              <Link className={claseEnlace} href="/legal/datos">
                Tratamiento de datos
              </Link>
            </li>
            <li>
              <Link className={claseEnlace} href="/legal/riesgo">
                Aviso de riesgo
              </Link>
            </li>
          </ul>
        </div>
        <p className="mt-7 max-w-[64em] text-[13px] leading-[1.6]">
          <NoTraducir>DocTraderPRO</NoTraducir> es una licencia de uso de software. No es asesoría
          de inversión ni administra capital de terceros. Operar en mercados financieros implica
          riesgo de pérdida; los resultados pasados no garantizan resultados futuros.
        </p>
      </div>
    </footer>
  );
}

/**
 * Datos estructurados (schema.org) para los buscadores: quién es la marca, su logo, sus redes y el sitio. Google
 * los usa para mostrar el logo y el nombre del sitio en los resultados.
 */
function DatosEstructurados({ datos }: { datos: Landing }) {
  const sitio = process.env.SITIO_URL ?? 'https://www.doctraderpro.com';
  const grafo = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${sitio}/#organizacion`,
        name: 'DocTraderPRO',
        url: sitio,
        logo: `${sitio}/marca/logo-doctraderpro-512.png`,
        email: datos.correoSoporte,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Barranquilla',
          addressCountry: 'CO',
        },
        sameAs: [datos.enlaces.instagram],
      },
      {
        '@type': 'WebSite',
        '@id': `${sitio}/#sitio`,
        name: 'DocTraderPRO',
        url: sitio,
        inLanguage: 'es',
        publisher: { '@id': `${sitio}/#organizacion` },
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // JSON sin "<" para que ningún texto pueda cerrar la etiqueta.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(grafo).replace(/</g, '\\u003c') }}
    />
  );
}
