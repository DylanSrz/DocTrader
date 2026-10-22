import type { Metadata } from 'next';
import {
  aplicarPorcentaje,
  formatearPorcentaje,
  formatearUsd,
  normalizarCodigo,
} from '@doctrader/shared';
import { type CSSProperties, type ReactNode, Suspense } from 'react';
import Image from 'next/image';
import { FranjaLogos } from '@/components/landing/franja-logos';
import { Particulas } from '@/components/landing/particulas';
import { CodigoQr } from '@/components/panel/codigo-qr';
import { type Diapositiva, Visor } from '@/components/presentacion/visor';
import { planesEnVenta } from '@/lib/planes';
import { obtenerLanding, type Landing } from '@/lib/publico';
import { enlaceDeReferido, invitacion, SITIO } from '@/lib/referidos';
import logo from '../../../public/marca/logo-icon.png';

/*
  Presentación de ventas (`docs/PLAN-TRABAJO.md`, etapa 10): diapositivas a pantalla completa para las reuniones con
  clientes, con los precios y las cifras de Myfxbook en vivo (las mismas de la landing). No se indexa ni está en el
  sitemap: la abre quien tenga el enlace. Mismas reglas que la web: licencia de software, sin promesas de ganancia.
*/

export const metadata: Metadata = {
  title: 'Presentación',
  robots: { index: false, follow: false },
};

const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const dolares = (centavos: number) => numero.format(centavos / 100);
const fechaLarga = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Un elemento que entra con la diapositiva; `orden` escalona la entrada. */
function Entra({
  orden = 0,
  className,
  children,
}: {
  orden?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`entra ${className ?? ''}`} style={{ '--i': orden } as CSSProperties}>
      {children}
    </div>
  );
}

/** Marco de cada diapositiva: la marca arriba, el tema de la diapositiva y el contenido. */
function Marco({ tema, children }: { tema?: string; children: ReactNode }) {
  return (
    <div className="diapositiva-marco">
      <div className="diapositiva-cabeza">
        <span className="inline-flex items-center gap-[1.4cqmin]">
          <Image src={logo} alt="" className="h-[4.2cqmin] w-auto" />
          <span className="font-semibold tracking-[-0.02em]" translate="no">
            DocTraderPRO
          </span>
        </span>
        {tema ? <span className="text-ceniza">{tema}</span> : null}
      </div>
      <div className="diapositiva-cuerpo">{children}</div>
    </div>
  );
}

function Portada() {
  return (
    <div className="diapositiva-marco">
      <div className="grid h-full items-center gap-[4cqmin] [grid-template-columns:minmax(0,1.25fr)_minmax(0,1fr)] @max-[700px]:[grid-template-columns:1fr]">
        <div className="grid content-center justify-items-start gap-[3.6cqmin]">
          <Entra>
            <p className="p-etiqueta">Licencia de software de copy trading</p>
          </Entra>
          <Entra orden={1}>
            <h1 className="p-titulo-xl">Tu cuenta, conectada al sistema DocTrader Pro.</h1>
          </Entra>
          <Entra orden={2}>
            <p className="p-texto max-w-[30em] text-niebla">
              <span translate="no">Doc Trader Pro AI</span> replica en tu cuenta cada operación del
              sistema, en el broker que tú elijas.
            </p>
          </Entra>
        </div>
        <div className="relative aspect-[255/305] h-[64cqmin] max-h-full justify-self-center @max-[700px]:hidden">
          <Particulas
            logo
            sueltas={50}
            className="solo-pantalla absolute -inset-[12%] block h-[124%] w-[124%]"
          />
          <Image src={logo} alt="" className="solo-impresion h-full w-auto" />
        </div>
      </div>
    </div>
  );
}

function Problema() {
  const puntos = [
    [
      'No puedes estar frente a la pantalla todo el día.',
      'El mercado se mueve de domingo a viernes, a cualquier hora.',
    ],
    [
      'Las emociones deciden por ti.',
      'El miedo cierra antes de tiempo; un sistema sigue sus reglas siempre.',
    ],
    [
      'Las señales no se pueden comprobar.',
      'Una captura no muestra el historial completo. El de este sistema lo audita Myfxbook.',
    ],
  ];
  return (
    <Marco tema="El problema">
      <Entra>
        <h2 className="p-titulo">Operar a mano cuesta más que tiempo.</h2>
      </Entra>
      <ul className="p-columnas">
        {puntos.map(([titulo, texto], i) => (
          <li key={titulo}>
            <Entra orden={i + 1} className="grid gap-[1.6cqmin]">
              <h3 className="p-subtitulo">{titulo}</h3>
              <p className="p-texto text-niebla">{texto}</p>
            </Entra>
          </li>
        ))}
      </ul>
    </Marco>
  );
}

function QueEs() {
  const puntos = [
    ['Tu dinero no sale de tu cuenta.', 'Sigue en tu broker, a tu nombre.'],
    ['Tú eliges el broker.', 'El que prefieras. Si no tienes uno, te sugerimos JustMarkets.'],
    [
      'Cada operación se replica.',
      'Lo que abre y cierra el sistema se abre y se cierra en tu cuenta.',
    ],
  ];
  return (
    <Marco tema="Qué es">
      <Entra>
        <h2 className="p-titulo max-w-[18em]">
          Una licencia de uso del software <span translate="no">Doc Trader Pro AI</span>.
        </h2>
      </Entra>
      <ul className="p-columnas">
        {puntos.map(([titulo, texto], i) => (
          <li key={titulo}>
            <Entra orden={i + 1} className="grid gap-[1.6cqmin]">
              <h3 className="p-subtitulo">{titulo}</h3>
              <p className="p-texto text-niebla">{texto}</p>
            </Entra>
          </li>
        ))}
      </ul>
      <Entra orden={4}>
        <p className="p-pequeno text-ceniza">
          No es asesoría de inversión ni administramos dinero de terceros.
        </p>
      </Entra>
    </Marco>
  );
}

function ComoFunciona() {
  const pasos = [
    ['Crea tu cuenta', 'Nombre, documento, correo y teléfono.'],
    ['Agrega tu cuenta de trading', 'Broker, servidor y contraseñas, guardadas cifradas.'],
    ['Paga la licencia', 'Con USDT o Bitcoin. Revisamos el pago en la blockchain.'],
    ['Conectamos tu cuenta', 'Te avisamos por correo. Desde ahí, cada operación se replica.'],
  ];
  return (
    <Marco tema="Cómo funciona">
      <Entra>
        <h2 className="p-titulo">Cuatro pasos y tu cuenta queda conectada.</h2>
      </Entra>
      <ol className="p-pasos">
        {pasos.map(([titulo, texto], i) => (
          <li key={titulo}>
            <Entra orden={i + 1} className="grid gap-[1.4cqmin]">
              <span aria-hidden="true" className="p-cifra-paso">
                {i + 1}
              </span>
              <h3 className="p-subtitulo">{titulo}</h3>
              <p className="p-texto text-niebla">{texto}</p>
            </Entra>
          </li>
        ))}
      </ol>
    </Marco>
  );
}

function Resultados({ myfxbook }: { myfxbook: Landing['myfxbook'] }) {
  const { gainPercent, asOf } = myfxbook.figures;
  return (
    <Marco tema="Resultados">
      <div className="grid h-full content-center gap-[3cqmin]">
        <Entra>
          <h2 className="p-titulo">Resultados que puedes revisar tú mismo.</h2>
        </Entra>
        {gainPercent ? (
          <Entra orden={1} className="grid gap-[1cqmin]">
            <p className="p-cifra-grande">+{numero.format(Number(gainPercent))} %</p>
            <p className="p-texto text-ceniza">Ganancia total de la cuenta del sistema</p>
          </Entra>
        ) : null}
        <Entra orden={2} className="grid max-w-[44em] gap-[1.6cqmin]">
          <p className="p-texto text-niebla">
            <span translate="no">Myfxbook</span> es un verificador independiente: lee el historial
            directamente del broker, así que nadie puede editarlo.
          </p>
          <p className="p-pequeno text-senal">
            {asOf ? `Cifras al ${fechaLarga.format(new Date(asOf))}. ` : ''}
            Los resultados pasados no garantizan resultados futuros.
          </p>
          <p className="p-pequeno break-all text-ceniza">{myfxbook.url}</p>
        </Entra>
      </div>
    </Marco>
  );
}

function Seguridad() {
  const puntos = [
    [
      'Tu dinero en tu cuenta',
      'El sistema abre y cierra operaciones; los retiros los haces tú en tu broker.',
    ],
    ['Contraseñas cifradas', 'Las de tu cuenta de trading se guardan cifradas.'],
    ['Pagos comprobados', 'Cada pago se verifica en la blockchain antes de aprobarlo.'],
    ['Soporte cercano', 'Tickets en tu panel y grupo de Telegram.'],
  ];
  return (
    <Marco tema="Seguridad">
      <Entra>
        <h2 className="p-titulo">Hecho para que confíes en cada paso.</h2>
      </Entra>
      <ul className="p-rejilla">
        {puntos.map(([titulo, texto], i) => (
          <li key={titulo}>
            <Entra orden={i + 1} className="grid gap-[1.2cqmin]">
              <h3 className="p-subtitulo">{titulo}</h3>
              <p className="p-texto text-niebla">{texto}</p>
            </Entra>
          </li>
        ))}
      </ul>
    </Marco>
  );
}

function ConQueFunciona() {
  return (
    <Marco tema="Con qué funciona">
      <div className="grid h-full content-center gap-[6cqmin] [grid-template-columns:minmax(0,1fr)]">
        <Entra>
          <h2 className="p-titulo">Herramientas que el mundo del trading ya conoce.</h2>
        </Entra>
        <Entra orden={1} className="min-w-0">
          <FranjaLogos className="p-franja" />
        </Entra>
      </div>
    </Marco>
  );
}

function Planes({ planes }: { planes: Landing['planes'] }) {
  const { publicos, ahorroDe, recomendado } = planesEnVenta(planes);
  return (
    <Marco tema="Planes">
      <Entra>
        <h2 className="p-titulo">Una licencia por cuenta de trading.</h2>
      </Entra>
      <div className="p-planes">
        {publicos.map((plan, i) => {
          const meses = (plan.meses ?? 0) + plan.mesesObsequio;
          const ahorro = ahorroDe(plan);
          return (
            <Entra key={plan.codigo} orden={i + 1} className="p-plan">
              <div className="flex flex-wrap items-center gap-[1.4cqmin]">
                <h3 className="p-subtitulo">{plan.nombre}</h3>
                {plan === recomendado ? (
                  <span className="p-insignia-llena">Recomendado</span>
                ) : null}
                {ahorro > 0 ? (
                  <span className="p-insignia">Ahorras USD {dolares(ahorro)}</span>
                ) : null}
              </div>
              <p className="flex items-baseline gap-[1.6cqmin]">
                <strong className="p-precio">{dolares(plan.precioUsdCentavos)}</strong>
                <span className="p-texto text-ceniza">
                  USD por {meses}&nbsp;{meses === 1 ? 'mes' : 'meses'}
                </span>
              </p>
              {plan.dolaresPorMes !== null && meses > 1 ? (
                <p className="p-texto text-niebla">Equivale a USD {plan.dolaresPorMes} al mes</p>
              ) : (
                <p className="p-texto text-niebla">Para empezar sin comprometerte</p>
              )}
            </Entra>
          );
        })}
      </div>
      <Entra orden={4}>
        <p className="p-pequeno text-ceniza">
          Pagas una vez por periodo, sin renovación automática. Con USDT (Tron) o Bitcoin. Sin
          devoluciones.
        </p>
      </Entra>
    </Marco>
  );
}

function Referidos({ datos }: { datos: Landing }) {
  const pct = formatearPorcentaje(datos.referidos.porcentajeBp);
  const { publicos } = planesEnVenta(datos.planes);
  const puntos: [string, ReactNode][] = [
    [
      'Tu propio enlace',
      'Con tu licencia activa, en tu panel tienes un enlace y un código QR para compartir.',
    ],
    [
      `El ${pct} de cada licencia`,
      <span key="ejemplos" className="grid gap-[0.6cqmin]">
        {publicos.map((plan) => (
          <span key={plan.codigo}>
            {plan.nombre}: {formatearUsd(plan.precioUsdCentavos)} →{' '}
            <span className="text-blanco">
              {formatearUsd(
                aplicarPorcentaje(plan.precioUsdCentavos, datos.referidos.porcentajeBp),
              )}
            </span>{' '}
            para ti
          </span>
        ))}
      </span>,
    ],
    ['Mientras sea cliente', 'Ganas en cada compra y cada renovación de quien invitaste.'],
    ['Pago quincenal', 'Te enviamos lo ganado en USDT, a tu billetera en la red Tron.'],
  ];
  return (
    <Marco tema="Referidos">
      <Entra>
        <h2 className="p-titulo">Recomienda y gana el {pct}.</h2>
      </Entra>
      <ul className="p-rejilla">
        {puntos.map(([titulo, texto], i) => (
          <li key={titulo}>
            <Entra orden={i + 1} className="grid gap-[1.2cqmin]">
              <h3 className="p-subtitulo">{titulo}</h3>
              <p className="p-texto text-niebla">{texto}</p>
            </Entra>
          </li>
        ))}
      </ul>
    </Marco>
  );
}

function Cierre({ datos, codigo }: { datos: Landing; codigo: string | null }) {
  // Si quien presenta trae su código (`?ref=`), el QR lleva su enlace y el registro queda a su nombre.
  const registro = codigo ? enlaceDeReferido(codigo) : `${SITIO}/registro`;
  return (
    <Marco tema="Empieza hoy">
      <div className="grid h-full items-center gap-[5cqmin] [grid-template-columns:minmax(0,1.3fr)_auto] @max-[700px]:[grid-template-columns:1fr]">
        <div className="grid content-center justify-items-start gap-[3cqmin]">
          <Entra>
            <h2 className="p-titulo-xl">Empieza con una cuenta.</h2>
          </Entra>
          <Entra orden={1}>
            <p className="p-texto text-niebla">
              Escanea el código o entra a{' '}
              <span className="text-blanco" translate="no">
                {registro.replace(/^https?:\/\//, '')}
              </span>
              . En minutos tienes tu orden de pago lista.
            </p>
          </Entra>
          <Entra orden={2} className="grid gap-[0.8cqmin]">
            <p className="p-texto">
              Telegram:{' '}
              <span className="text-niebla">
                {datos.enlaces.telegram.replace(/^https?:\/\//, '')}
              </span>
            </p>
            <p className="p-texto">
              Correo: <span className="text-niebla">{datos.correoSoporte}</span>
            </p>
          </Entra>
          <Entra orden={3}>
            <p className="p-pequeno max-w-[48em] text-ceniza">
              <span translate="no">DocTraderPRO</span> es una licencia de uso de software. No es
              asesoría de inversión. Operar en mercados financieros implica riesgo de pérdida; los
              resultados pasados no garantizan resultados futuros.
            </p>
          </Entra>
        </div>
        <Entra orden={2} className="justify-self-center">
          <CodigoQr
            texto={registro}
            etiqueta="Código QR para registrarse en DocTraderPRO"
            className="size-[42cqmin] p-[1.2cqmin]"
          />
        </Entra>
      </div>
    </Marco>
  );
}

type Parametros = Promise<{ ref?: string | string[] }>;

/** `?ref=CODIGO`: solo un código que sirve hoy cambia el QR del cierre; uno inválido se ignora. */
async function codigoDe(parametros: Parametros): Promise<string | null> {
  const { ref } = await parametros;
  const codigo = normalizarCodigo(typeof ref === 'string' ? ref : null);
  return codigo && (await invitacion(codigo)) ? codigo : null;
}

export default function Presentacion({ searchParams }: { searchParams: Parametros }) {
  // El código del QR depende de la URL: la presentación se arma al pedirla (los datos siguen en caché).
  return (
    <Suspense fallback={null}>
      <Contenido parametros={searchParams} />
    </Suspense>
  );
}

async function Contenido({ parametros }: { parametros: Parametros }) {
  const [datos, codigo] = await Promise.all([obtenerLanding(), codigoDe(parametros)]);
  const diapositivas: Diapositiva[] = [
    {
      titulo: 'Portada',
      notas:
        'Preséntate y pregunta cómo opera hoy la persona: ¿a mano, con señales, o no opera? La idea en una frase: su cuenta, conectada a un sistema que opera por ella, en su propio broker.',
      contenido: <Portada />,
    },
    {
      titulo: 'El problema',
      notas:
        'Conecta con su experiencia: falta de tiempo, decisiones por miedo o esperanza, señales que nadie puede verificar. Pregunta cuál de las tres le pasa más.',
      contenido: <Problema />,
    },
    {
      titulo: 'Qué es',
      notas:
        'Deja claro que vende una licencia de software, no un servicio de inversión. El dinero se queda en su cuenta y en su broker. Nunca prometas ganancias.',
      contenido: <QueEs />,
    },
    {
      titulo: 'Cómo funciona',
      notas:
        'Recorre los cuatro pasos. Resalta que el registro toma un minuto, que las contraseñas se guardan cifradas y que le avisamos por correo cuando su cuenta queda conectada.',
      contenido: <ComoFunciona />,
    },
    {
      titulo: 'Resultados',
      notas:
        'Muestra que el historial lo audita Myfxbook y que puede revisarlo por su cuenta (el enlace está en la diapositiva). Repite siempre que los resultados pasados no garantizan resultados futuros.',
      contenido: <Resultados myfxbook={datos.myfxbook} />,
    },
    {
      titulo: 'Seguridad',
      notas:
        'Responde la duda más común: el sistema abre y cierra operaciones, pero el dinero sigue en su broker y los retiros los hace él. Los pagos se revisan en la blockchain y hay soporte por tickets y Telegram.',
      contenido: <Seguridad />,
    },
    {
      titulo: 'Con qué funciona',
      notas:
        'Herramientas conocidas: MetaTrader 4, Myfxbook, JustMarkets, TradingView. Pagos en USDT por la red Tron o en Bitcoin.',
      contenido: <ConQueFunciona />,
    },
    {
      titulo: 'Planes',
      notas:
        'Los precios salen del panel y siempre están al día. Recomienda el semestral por el ahorro; el mensual sirve para empezar. Es un pago por periodo, sin cobros automáticos, y no hay devoluciones.',
      contenido: <Planes planes={datos.planes} />,
    },
    ...(datos.referidos.activo
      ? [
          {
            titulo: 'Gana con referidos',
            notas:
              'Solo si la persona muestra interés o ya es cliente: con su licencia activa puede recomendar el sistema y ganar un porcentaje de cada licencia que paguen sus invitados, mientras sigan siendo clientes. Se paga en USDT cada quincena. No es un ingreso garantizado ni un trabajo.',
            contenido: <Referidos datos={datos} />,
          },
        ]
      : []),
    {
      titulo: 'Empieza hoy',
      notas:
        'Invita a escanear el QR y registrarse en el momento; acompáñalo en el primer paso si está contigo. Deja el Telegram y el correo de soporte para dudas.',
      contenido: <Cierre datos={datos} codigo={codigo} />,
    },
  ];
  return <Visor diapositivas={diapositivas} />;
}
