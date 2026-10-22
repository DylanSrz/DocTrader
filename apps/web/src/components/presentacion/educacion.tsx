import { GraficoEnVivo } from './grafico-en-vivo';
import { Entra, Marco, Puntos } from './marco';

/*
  Primera parte de la presentación, en el orden en que la cuenta DocTrader Pro en las reuniones: qué es un gráfico,
  cómo se opera, qué hace falta, por qué operar a mano sale caro y por qué la tecnología gana. Las cifras llevan su
  fuente en la misma diapositiva.
*/

export function AntesDeEmpezar() {
  return (
    <Marco tema="Antes de empezar">
      <Entra>
        <h2 className="p-titulo">Lo que vas a ver es tecnología, no una promesa.</h2>
      </Entra>
      <Puntos
        puntos={[
          [
            'Vendemos una licencia de software.',
            'De uso del sistema Doc Trader Pro AI. No es asesoría de inversión y no administramos tu dinero.',
          ],
          [
            'Operar tiene riesgo alto.',
            'Puedes perder parte o todo tu capital. Opera solo con dinero que puedas arriesgar.',
          ],
          [
            'El pasado no garantiza el futuro.',
            'Los resultados que mostramos son reales y auditados, pero no aseguran resultados futuros.',
          ],
        ]}
      />
    </Marco>
  );
}

export function GraficoDeTrading() {
  const partes = [
    [
      'Cada vela es un periodo.',
      'Aquí, 15 minutos: dónde abrió y cerró el precio, y hasta dónde llegó.',
    ],
    ['Verde sube, roja baja.', 'El color dice si el periodo cerró por encima o por debajo.'],
    ['Precio y tiempo.', 'El precio va a la derecha; la hora, abajo.'],
  ] as const;
  return (
    <Marco tema="El mercado">
      <div className="grid min-h-0 items-center gap-[4cqmin] [grid-template-columns:minmax(0,1.7fr)_minmax(0,1fr)] @max-[700px]:[grid-template-columns:minmax(0,1fr)]">
        <Entra className="h-[62cqmin] min-w-0">
          <GraficoEnVivo />
        </Entra>
        <div className="grid content-center gap-[3cqmin]">
          <Entra>
            <h2 className="p-subtitulo-xl">Esto es un gráfico de trading.</h2>
          </Entra>
          <Entra orden={1}>
            <p className="solo-pantalla p-pequeno text-ceniza">
              Oro contra dólar (XAU/USD), en vivo en <span translate="no">TradingView</span>.
            </p>
            <p className="solo-impresion p-pequeno text-ceniza">
              Velas de ejemplo. En la presentación en vivo, el oro (XAU/USD) en{' '}
              <span translate="no">TradingView</span>.
            </p>
          </Entra>
          <ul className="grid gap-[2.4cqmin]">
            {partes.map(([titulo, texto], i) => (
              <li key={titulo}>
                <Entra orden={i + 2} className="grid gap-[0.6cqmin]">
                  <h3 className="p-texto font-semibold">{titulo}</h3>
                  <p className="p-pequeno text-niebla">{texto}</p>
                </Entra>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Marco>
  );
}

/** El recorrido de una compra: entra, el precio sube hasta el take profit; el stop loss queda debajo. */
function Operacion() {
  const niveles = [
    { y: 28, texto: 'Take profit', color: 'var(--color-senal)' },
    { y: 92, texto: 'Entrada', color: 'var(--color-blanco)' },
    { y: 132, texto: 'Stop loss', color: 'var(--color-brasa)' },
  ];
  return (
    <svg
      viewBox="0 0 320 160"
      className="h-full w-full"
      role="img"
      aria-label="Ejemplo de una compra: se entra en un precio, el take profit está arriba y el stop loss abajo"
    >
      {niveles.map((n) => (
        <g key={n.texto}>
          <line
            x1="0"
            x2="236"
            y1={n.y}
            y2={n.y}
            stroke={n.color}
            strokeDasharray="4 4"
            strokeOpacity="0.7"
          />
          <text x="244" y={n.y + 4} fontSize="11" fill={n.color}>
            {n.texto}
          </text>
        </g>
      ))}
      <polyline
        points="0,104 24,98 44,92 64,100 86,88 106,94 128,74 150,80 170,60 192,52 212,38 230,28"
        fill="none"
        stroke="var(--color-llama)"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="44" cy="92" r="4.5" fill="var(--color-blanco)" />
      <circle cx="230" cy="28" r="4.5" fill="var(--color-senal)" />
    </svg>
  );
}

export function ComoSeOpera() {
  return (
    <Marco tema="Cómo se opera">
      <div className="grid min-h-0 items-center gap-[5cqmin] [grid-template-columns:minmax(0,1.1fr)_minmax(0,1fr)] @max-[700px]:[grid-template-columns:minmax(0,1fr)]">
        <div className="grid content-center gap-[3.4cqmin]">
          <Entra>
            <h2 className="p-titulo">Dos decisiones: comprar o vender.</h2>
          </Entra>
          <div className="grid grid-cols-2 gap-[3cqmin]">
            <Entra orden={1} className="p-tarjeta">
              <p className="p-subtitulo">
                <span aria-hidden="true" className="text-senal">
                  ↗{' '}
                </span>
                Comprar
              </p>
              <p className="p-pequeno text-niebla">
                Si crees que el precio va a subir. Ganas si sube; pierdes si baja.
              </p>
            </Entra>
            <Entra orden={2} className="p-tarjeta">
              <p className="p-subtitulo">
                <span aria-hidden="true" className="text-brasa">
                  ↘{' '}
                </span>
                Vender
              </p>
              <p className="p-pequeno text-niebla">
                Si crees que va a bajar. Ganas si baja; pierdes si sube.
              </p>
            </Entra>
          </div>
          <Entra orden={3}>
            <dl className="grid gap-[1.4cqmin] p-pequeno">
              <div>
                <dt className="inline font-semibold">Stop loss: </dt>
                <dd className="inline text-niebla">
                  la pérdida máxima que aceptas en la operación.
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold">Take profit: </dt>
                <dd className="inline text-niebla">el precio en el que se cierra con ganancia.</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Lote y apalancamiento: </dt>
                <dd className="inline text-niebla">
                  el tamaño de la operación. El apalancamiento multiplica las ganancias y también
                  las pérdidas.
                </dd>
              </div>
            </dl>
          </Entra>
        </div>
        <Entra orden={2} className="h-[46cqmin] min-w-0">
          <Operacion />
        </Entra>
      </div>
    </Marco>
  );
}

export function QueNecesitas() {
  const piezas = [
    [
      'Un broker',
      'La empresa que te da acceso al mercado. Tu dinero queda en una cuenta a tu nombre.',
    ],
    ['Una cuenta de trading', 'Se abre en línea con tu documento. Puede ser real o de práctica.'],
    ['Una plataforma', 'MetaTrader: donde se ven los gráficos y se ejecutan las operaciones.'],
    ['Capital', 'El dinero con el que operas. Empieza con lo que puedas arriesgar.'],
  ] as const;
  return (
    <Marco tema="Qué necesitas">
      <Entra>
        <h2 className="p-titulo">Para operar necesitas un broker.</h2>
      </Entra>
      <ol className="p-pasos">
        {piezas.map(([titulo, texto], i) => (
          <li key={titulo}>
            <Entra orden={i + 1} className="grid gap-[1.2cqmin]">
              <h3 className="p-subtitulo">{titulo}</h3>
              <p className="p-pequeno text-niebla">{texto}</p>
            </Entra>
          </li>
        ))}
      </ol>
      <div className="grid items-end gap-[5cqmin] [grid-template-columns:auto_minmax(0,1fr)] @max-[700px]:[grid-template-columns:minmax(0,1fr)]">
        <Entra orden={5} className="grid gap-[0.6cqmin]">
          <p className="p-cifra-media">USD 7,5 billones</p>
          <p className="p-pequeno text-niebla">
            se negocian cada día en el mercado de divisas.{' '}
            <span className="text-ceniza">Fuente: BIS, encuesta trienal 2022.</span>
          </p>
        </Entra>
        <Entra orden={6}>
          <p className="p-pequeno max-w-[34em] text-niebla">
            <strong className="font-semibold text-blanco">Elige un broker regulado.</strong> Los
            supervisores, como la FCA (Reino Unido), CySEC (Chipre) o ASIC (Australia), publican las
            licencias: verifica la del tuyo en la página del regulador.
          </p>
        </Entra>
      </div>
    </Marco>
  );
}

export function OperarAMano() {
  return (
    <Marco tema="Operar a mano">
      <Entra>
        <h2 className="p-titulo">Cuando operas a mano, del otro lado no hay alguien como tú.</h2>
      </Entra>
      <div className="grid gap-[5cqmin] [grid-template-columns:repeat(3,minmax(0,1fr))] @max-[700px]:[grid-template-columns:minmax(0,1fr)]">
        <Entra
          orden={1}
          className="grid content-start gap-[1.4cqmin] border-t border-white/12 pt-[2.4cqmin]"
        >
          <h3 className="p-subtitulo">Contra quién operas</h3>
          <ul className="p-lista p-pequeno text-niebla">
            <li>Bancos y fondos, con equipos de analistas y mucho capital.</li>
            <li>Algoritmos que deciden y ejecutan en milisegundos.</li>
            <li>Traders con años de experiencia.</li>
          </ul>
        </Entra>
        <Entra
          orden={2}
          className="grid content-start gap-[1.4cqmin] border-t border-white/12 pt-[2.4cqmin]"
        >
          <h3 className="p-subtitulo">Lo que te hace perder</h3>
          <ul className="p-lista p-pequeno text-niebla">
            <li>Las emociones: miedo, codicia, querer recuperar lo perdido.</li>
            <li>El cansancio: el mercado se mueve de día y de noche.</li>
            <li>Operar sin método ni gestión de riesgo.</li>
          </ul>
        </Entra>
        <Entra
          orden={3}
          className="grid content-start gap-[1cqmin] border-t border-white/12 pt-[2.4cqmin]"
        >
          <p className="p-cifra-media">74–89 %</p>
          <p className="p-pequeno text-niebla">
            de las cuentas minoristas pierde dinero operando CFD.{' '}
            <span className="text-ceniza">Fuente: ESMA, 2018.</span>
          </p>
        </Entra>
      </div>
    </Marco>
  );
}

export function TecnologiaGana() {
  const pares = [
    ['Mapa de papel → GPS', 'Calcula la mejor ruta con el tráfico de este momento.'],
    ['Piloto → piloto automático', 'Los aviones hacen en automático la mayor parte del vuelo.'],
    ['Cuentas a mano → hoja de cálculo', 'Miles de operaciones en un segundo, sin errores.'],
    [
      'Gritos en la bolsa → algoritmos',
      'Hoy la mayoría de las órdenes en los grandes mercados las ejecutan programas.',
    ],
  ] as const;
  return (
    <Marco tema="Tecnología">
      <Entra>
        <h2 className="p-titulo">La tecnología le gana a lo análogo.</h2>
      </Entra>
      <Puntos forma="p-rejilla" puntos={pares} />
    </Marco>
  );
}

export function PorQueAutomatico() {
  return (
    <Marco tema="Automático con IA">
      <Entra>
        <h2 className="p-titulo">Un sistema que no se cansa ni se asusta.</h2>
      </Entra>
      <Puntos
        forma="p-rejilla"
        puntos={[
          ['Sin emociones', 'Sigue sus reglas igual en un día tranquilo que en uno de pánico.'],
          ['24 horas, 5 días', 'Opera mientras duermes o trabajas.'],
          [
            'Riesgo definido',
            'El tamaño y los límites de cada operación se fijan antes de entrar.',
          ],
          ['Velocidad', 'Analiza y ejecuta en milisegundos.'],
        ]}
      />
      <Entra orden={5}>
        <p className="p-texto text-niebla">
          <strong className="font-semibold text-blanco">Tú supervisas:</strong> ves cada operación
          en tu broker y retiras cuando quieras.
        </p>
      </Entra>
    </Marco>
  );
}

/** Aportes en línea recta contra aportes con interés compuesto: la forma, sin cifras. */
function Curvas() {
  const puntos = Array.from({ length: 31 }, (_, i) => i);
  const aportes = puntos.map((i) => `${i * 10},${150 - i * 2.4}`).join(' ');
  // El mismo aporte cada año, con un rendimiento que solo sirve para dibujar la forma (no se muestra ninguna tasa).
  const compuesto = puntos
    .map((i) => `${i * 10},${(150 - (2.4 * (1.042 ** i - 1)) / 0.042).toFixed(1)}`)
    .join(' ');
  return (
    <svg
      viewBox="0 0 330 170"
      className="h-full w-full"
      role="img"
      aria-label="Ejemplo de forma: lo aportado crece en línea recta; con interés compuesto, la curva se acelera con los años"
    >
      <polygon points={`0,150 ${compuesto} 300,150`} fill="rgb(251 152 25 / 0.14)" />
      <polyline points={compuesto} fill="none" stroke="var(--color-llama)" strokeWidth="2.6" />
      <polyline
        points={aportes}
        fill="none"
        stroke="var(--color-niebla)"
        strokeWidth="1.6"
        strokeDasharray="5 5"
      />
      <line x1="0" x2="300" y1="150" y2="150" stroke="rgb(255 255 255 / 0.25)" />
      <text x="300" y="164" fontSize="10" textAnchor="end" fill="var(--color-ceniza)">
        Años →
      </text>
    </svg>
  );
}

export function Objetivo() {
  return (
    <Marco tema="Nuestro objetivo">
      <div className="grid min-h-0 items-center gap-[5cqmin] [grid-template-columns:minmax(0,1.05fr)_minmax(0,1fr)] @max-[700px]:[grid-template-columns:minmax(0,1fr)]">
        <div className="grid content-center gap-[3cqmin]">
          <Entra>
            <h2 className="p-titulo">No solo ingresos: un retiro, una pensión, un patrimonio.</h2>
          </Entra>
          <Entra orden={1}>
            <p className="p-texto text-niebla">
              Con el interés compuesto, lo que ganas también gana. Reinvertir y darle tiempo es lo
              que convierte un capital en patrimonio.
            </p>
          </Entra>
          <Entra orden={2}>
            <p className="p-subtitulo text-llama-viva">El tiempo es el ingrediente principal.</p>
          </Entra>
        </div>
        <Entra
          orden={2}
          className="grid h-[50cqmin] min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-[1.6cqmin]"
        >
          <Curvas />
          <p className="flex flex-wrap gap-x-[3cqmin] gap-y-[0.6cqmin] p-pequeno text-ceniza">
            <span>
              <span aria-hidden="true" className="text-llama">
                ━{' '}
              </span>
              Con interés compuesto
            </span>
            <span>
              <span aria-hidden="true">┅ </span>Solo lo aportado
            </span>
          </p>
        </Entra>
      </div>
    </Marco>
  );
}
