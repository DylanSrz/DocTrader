/**
 * Velas japonesas dibujadas (sin precios reales): la versión impresa del gráfico de TradingView y el ejemplo de la
 * diapositiva "Cómo se opera". Los valores son fijos para que el PDF salga siempre igual.
 */
const VELAS: [abre: number, cierra: number, maximo: number, minimo: number][] = [
  [52, 58, 61, 49],
  [58, 55, 60, 52],
  [55, 63, 66, 54],
  [63, 61, 67, 58],
  [61, 68, 71, 60],
  [68, 66, 70, 62],
  [66, 72, 76, 65],
  [72, 70, 74, 66],
  [70, 64, 71, 61],
  [64, 60, 66, 57],
  [60, 65, 67, 58],
  [65, 71, 73, 63],
  [71, 78, 80, 70],
  [78, 76, 81, 73],
  [76, 82, 85, 75],
  [82, 80, 84, 77],
  [80, 86, 89, 79],
  [86, 84, 88, 81],
  [84, 90, 93, 83],
  [90, 88, 92, 85],
  [88, 82, 89, 79],
  [82, 85, 87, 80],
  [85, 91, 94, 84],
  [91, 96, 98, 89],
];

export function Velas({ className }: { className?: string }) {
  const ancho = 10;
  const paso = 16;
  const alto = 120;
  const y = (v: number) => alto - ((v - 40) / 65) * alto;
  return (
    <svg
      viewBox={`0 0 ${VELAS.length * paso + 40} ${alto + 24}`}
      className={className}
      role="img"
      aria-label="Gráfico de velas de ejemplo: cada vela muestra la apertura, el cierre, el máximo y el mínimo de un periodo"
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1="0"
          x2={VELAS.length * paso}
          y1={alto * f}
          y2={alto * f}
          stroke="rgb(255 255 255 / 0.08)"
        />
      ))}
      {VELAS.map(([abre, cierra, maximo, minimo], i) => {
        const sube = cierra >= abre;
        // Los colores de TradingView, para que el texto "verde sube, roja baja" valga también en el PDF.
        const color = sube ? '#26a69a' : '#ef5350';
        const x = i * paso + 4;
        return (
          <g key={i}>
            <line
              x1={x + ancho / 2}
              x2={x + ancho / 2}
              y1={y(maximo)}
              y2={y(minimo)}
              stroke={color}
              strokeWidth="1.4"
            />
            <rect
              x={x}
              y={y(Math.max(abre, cierra))}
              width={ancho}
              height={Math.max(1.5, Math.abs(y(abre) - y(cierra)))}
              rx="1"
              fill={color}
            />
          </g>
        );
      })}
      <line
        x1={VELAS.length * paso + 2}
        x2={VELAS.length * paso + 2}
        y1="0"
        y2={alto}
        stroke="rgb(255 255 255 / 0.2)"
      />
      {[90, 70, 50].map((v) => (
        <text
          key={v}
          x={VELAS.length * paso + 6}
          y={y(v) + 3}
          fontSize="8"
          fill="var(--color-ceniza)"
        >
          {v}
        </text>
      ))}
      <line
        x1="0"
        x2={VELAS.length * paso}
        y1={alto + 4}
        y2={alto + 4}
        stroke="rgb(255 255 255 / 0.2)"
      />
      {['09:00', '11:00', '13:00', '15:00'].map((h, i) => (
        <text key={h} x={i * 6 * paso + 4} y={alto + 16} fontSize="8" fill="var(--color-ceniza)">
          {h}
        </text>
      ))}
    </svg>
  );
}
