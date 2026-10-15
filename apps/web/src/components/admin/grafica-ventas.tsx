import type { CodigoPlan } from '@doctrader/shared';
import { usd } from '@/lib/formato';

/**
 * Ventas del mes como pictograma: un triángulo por licencia vendida, apilados por día (propuesta 2, "La gráfica de
 * ventas"). Colores validados sobre negro; la prueba va vacía para distinguirse por la forma y no solo por el
 * color. Cada día lleva su detalle en un `<title>` y la misma información está en la tabla de abajo.
 */

const COLOR: Record<CodigoPlan, string> = {
  SEMESTRAL: '#D17A0C',
  TRIMESTRAL: '#4A88D8',
  MENSUAL: '#C0589A',
  PRUEBA: '#969430',
};
const NOMBRE: Record<CodigoPlan, string> = {
  SEMESTRAL: 'semestral',
  TRIMESTRAL: 'trimestral',
  MENSUAL: 'mensual',
  PRUEBA: 'prueba',
};
/** Orden de la pila: los planes largos abajo. */
const ORDEN: CodigoPlan[] = ['SEMESTRAL', 'TRIMESTRAL', 'MENSUAL', 'PRUEBA'];

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

function triangulo(x: number, y: number, lado: number): string {
  return `M${x + lado / 2} ${y}L${x + lado} ${y + lado * 0.9}H${x}Z`;
}

export function GraficaVentas({
  porDia,
  calendario,
}: {
  porDia: { dia: number; plan: CodigoPlan; n: number; usdCentavos: number }[];
  calendario: { hoy: number; dias: number; mes: number };
}) {
  const mes = MESES[calendario.mes - 1] ?? '';
  const dias = Array.from({ length: calendario.dias }, (_, i) => i + 1);
  const delDia = (d: number) =>
    ORDEN.flatMap((plan) => {
      const fila = porDia.find((f) => f.dia === d && f.plan === plan);
      return fila ? Array.from({ length: fila.n }, () => plan) : [];
    });
  const usdDelDia = (d: number) =>
    porDia.filter((f) => f.dia === d).reduce((suma, f) => suma + f.usdCentavos, 0);
  const planesDelMes = ORDEN.filter((p) => porDia.some((f) => f.plan === p));
  const leyenda =
    planesDelMes.length > 0 ? planesDelMes : (['SEMESTRAL', 'MENSUAL'] as CodigoPlan[]);

  const paso = 22;
  const lado = 15;
  const maximo = Math.max(4, ...dias.map((d) => delDia(d).length));
  const base = maximo * (lado + 2) + 2;
  const ancho = calendario.dias * paso;

  return (
    <figure className="grid gap-[18px]">
      <ul
        aria-label="Leyenda"
        className="flex flex-wrap gap-x-[22px] gap-y-1.5 text-[13px] text-niebla"
      >
        {leyenda.map((plan) => (
          <li key={plan} className="inline-flex items-center gap-2">
            <svg viewBox="0 0 12 11" aria-hidden="true" className="h-[11px] w-3">
              {plan === 'PRUEBA' ? (
                <path d="M6 1.6 10.4 9.5H1.6Z" fill="none" stroke={COLOR[plan]} strokeWidth="1.4" />
              ) : (
                <path d="M6 1 11 10H1Z" fill={COLOR[plan]} />
              )}
            </svg>
            {NOMBRE[plan].charAt(0).toUpperCase() + NOMBRE[plan].slice(1)}
          </li>
        ))}
      </ul>
      <div className="-mx-2 overflow-x-auto px-2">
        <svg
          role="img"
          aria-label={`Una licencia vendida por triángulo, día por día, en ${mes}. La tabla de abajo tiene los mismos datos.`}
          viewBox={`0 -6 ${ancho} ${base + 26}`}
          className="block h-auto w-full min-w-[520px] overflow-visible"
        >
          <line x1={0} x2={ancho} y1={base} y2={base} stroke="rgb(255 255 255 / 0.18)" />
          {dias.map((d) => {
            const ventas = delDia(d);
            const x = (d - 1) * paso + (paso - lado) / 2;
            const etiqueta = d === 1 || d % 5 === 0 || d === calendario.hoy;
            return (
              <g key={d}>
                <title>
                  {ventas.length === 0
                    ? `${d} de ${mes}: sin ventas`
                    : `${d} de ${mes}: ${usd(usdDelDia(d))}, ${ventas
                        .map((p) => `1 ${NOMBRE[p]}`)
                        .join(', ')}`}
                </title>
                <rect x={(d - 1) * paso} y={-6} width={paso} height={base + 6} fill="transparent" />
                {ventas.map((plan, i) => {
                  const y = base - (i + 1) * (lado + 2);
                  return plan === 'PRUEBA' ? (
                    <path
                      key={i}
                      d={triangulo(x + 1, y + 1, lado - 2)}
                      fill="none"
                      stroke={COLOR[plan]}
                      strokeWidth={1.5}
                    />
                  ) : (
                    <path key={i} d={triangulo(x, y, lado)} fill={COLOR[plan]} />
                  );
                })}
                {etiqueta ? (
                  <text
                    x={(d - 1) * paso + paso / 2}
                    y={base + 18}
                    textAnchor="middle"
                    className={
                      d === calendario.hoy ? 'fill-blanco text-[11px]' : 'fill-ceniza text-[11px]'
                    }
                  >
                    {d === calendario.hoy ? 'hoy' : d}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm text-ceniza underline decoration-white/35 underline-offset-[6px] hover:text-blanco [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Ver como tabla</span>
          <span className="hidden group-open:inline">Ocultar la tabla</span>
        </summary>
        <div className="-mx-2 mt-3 overflow-x-auto px-2">
          <table className="w-full min-w-[420px] border-collapse text-[14px]">
            <thead>
              <tr className="text-left text-[13px] text-ceniza">
                <th scope="col" className="pr-4 pb-2 font-normal">
                  Día
                </th>
                {leyenda.map((p) => (
                  <th key={p} scope="col" className="pr-4 pb-2 text-right font-normal">
                    {NOMBRE[p].charAt(0).toUpperCase() + NOMBRE[p].slice(1)}
                  </th>
                ))}
                <th scope="col" className="pb-2 text-right font-normal">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {dias
                .filter((d) => d <= calendario.hoy)
                .map((d) => {
                  const ventas = delDia(d);
                  return (
                    <tr key={d}>
                      <td className="py-1 pr-4">
                        {d} {mes.slice(0, 3)}
                      </td>
                      {leyenda.map((p) => (
                        <td key={p} className="cifra py-1 pr-4 text-right">
                          {ventas.filter((v) => v === p).length}
                        </td>
                      ))}
                      <td className="cifra py-1 text-right">{usd(usdDelDia(d))}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
