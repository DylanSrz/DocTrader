import { calendarioLicencia, type DiaCalendario } from '@doctrader/shared';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const CELDA = 10;
const TAMANO = 7;
const ROTULO = 30;
const FILA = 15;

/** Triángulo de `TAMANO` px con la punta arriba, en la celda (x, y). */
function triangulo(x: number, y: number): string {
  return `M${x + TAMANO / 2} ${y}L${x + TAMANO} ${y + TAMANO * 0.88}L${x} ${y + TAMANO * 0.88}Z`;
}

const TRAZO: Record<DiaCalendario, { fill: string; stroke: string; opacity?: number }> = {
  usado: { fill: 'none', stroke: 'var(--color-ceniza)', opacity: 0.4 },
  restante: { fill: 'none', stroke: 'var(--color-llama)' },
  hoy: { fill: 'var(--color-llama)', stroke: 'var(--color-llama)' },
  obsequio: { fill: 'none', stroke: 'var(--color-senal)' },
  'hoy-obsequio': { fill: 'var(--color-senal)', stroke: 'var(--color-senal)' },
};

/**
 * El tiempo de la licencia dibujado con triángulos (propuesta 2): una fila por mes y un triángulo por día. Los
 * días usados en gris tenue, los que quedan en naranja, hoy relleno y el mes de obsequio en verde limón.
 */
export function Calendario({
  inicio,
  fin,
  obsequios,
  etiqueta,
}: {
  inicio: Date;
  fin: Date;
  obsequios: { desde: Date; hasta: Date }[];
  etiqueta: string;
}) {
  const filas = calendarioLicencia(inicio, fin, new Date(), obsequios);
  const rutas = new Map<DiaCalendario, string>();
  filas.forEach((fila, f) => {
    fila.dias.forEach((dia, d) => {
      rutas.set(dia, (rutas.get(dia) ?? '') + triangulo(ROTULO + d * CELDA, f * FILA));
    });
  });
  const alto = Math.max(CELDA, filas.length * FILA - (FILA - CELDA));
  return (
    <svg
      role="img"
      aria-label={etiqueta}
      viewBox={`0 0 ${ROTULO + 31 * CELDA} ${alto}`}
      className="block h-auto w-full max-w-[380px] overflow-visible"
    >
      {filas.map((fila, f) => (
        <text
          key={f}
          x={0}
          y={f * FILA + TAMANO}
          aria-hidden="true"
          className="fill-ceniza text-[10px] font-normal"
        >
          {MESES[fila.mes]}
        </text>
      ))}
      {[...rutas].map(([dia, d]) => (
        <path
          key={dia}
          d={d}
          fill={TRAZO[dia].fill}
          stroke={TRAZO[dia].stroke}
          strokeOpacity={TRAZO[dia].opacity}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
