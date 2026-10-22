import { aplicarPorcentaje, formatearPorcentaje, formatearUsd } from '@doctrader/shared';
import { planesEnVenta } from '@/lib/planes';
import type { Landing } from '@/lib/publico';
import { Entra, Marco } from './marco';

/** "TÚ" en el centro, tu primera línea alrededor y la segunda más afuera. */
function Red({ pct, pct2 }: { pct: string; pct2: string | null }) {
  const centro = 110;
  const anillo = (n: number, radio: number, giro: number) =>
    Array.from({ length: n }, (_, i) => {
      const angulo = (i / n) * Math.PI * 2 + giro;
      return { x: centro + radio * Math.cos(angulo), y: centro + radio * Math.sin(angulo) };
    });
  const primera = anillo(3, 58, -Math.PI / 2);
  const segunda = pct2 ? anillo(6, 96, -Math.PI / 2 - Math.PI / 6) : [];
  return (
    <svg
      viewBox="0 0 220 220"
      className="h-full w-full"
      role="img"
      aria-label={`Tú en el centro: ganas el ${pct} de tu primera línea${pct2 ? ` y el ${pct2} de tu segunda línea` : ''}`}
    >
      {segunda.map((p, i) => {
        const padre = primera[Math.floor(i / 2)]!;
        return (
          <line
            key={`l2-${i}`}
            x1={padre.x}
            y1={padre.y}
            x2={p.x}
            y2={p.y}
            stroke="rgb(221 219 101 / 0.4)"
          />
        );
      })}
      {primera.map((p, i) => (
        <line
          key={`l1-${i}`}
          x1={centro}
          y1={centro}
          x2={p.x}
          y2={p.y}
          stroke="rgb(251 152 25 / 0.55)"
        />
      ))}
      {segunda.map((p, i) => (
        <g key={`n2-${i}`}>
          <circle cx={p.x} cy={p.y} r="12" fill="var(--color-vacio)" stroke="var(--color-senal)" />
          <text x={p.x} y={p.y + 3} fontSize="7.5" textAnchor="middle" fill="var(--color-senal)">
            {pct2}
          </text>
        </g>
      ))}
      {primera.map((p, i) => (
        <g key={`n1-${i}`}>
          <circle cx={p.x} cy={p.y} r="16" fill="var(--color-vacio)" stroke="var(--color-llama)" />
          <text
            x={p.x}
            y={p.y + 3.5}
            fontSize="9"
            textAnchor="middle"
            fill="var(--color-llama-viva)"
          >
            {pct}
          </text>
        </g>
      ))}
      <circle cx={centro} cy={centro} r="24" fill="var(--color-llama)" />
      <text
        x={centro}
        y={centro + 5}
        fontSize="14"
        fontWeight="700"
        textAnchor="middle"
        fill="var(--color-vacio)"
      >
        TÚ
      </text>
    </svg>
  );
}

/**
 * "Gana con referidos": la tabla de cuánto deja cada plan en cada línea, con los precios y los porcentajes en vivo,
 * y el esquema de la red. Solo dos líneas: no hay comisiones más abajo.
 */
export function Referidos({ datos }: { datos: Landing }) {
  const { porcentajeBp, segundaLineaBp } = datos.referidos;
  const pct = formatearPorcentaje(porcentajeBp);
  const pct2 = segundaLineaBp > 0 ? formatearPorcentaje(segundaLineaBp) : null;
  const { publicos } = planesEnVenta(datos.planes);
  return (
    <Marco tema="Referidos">
      <div className="grid min-h-0 items-center gap-[5cqmin] [grid-template-columns:minmax(0,1.35fr)_minmax(0,1fr)] @max-[700px]:[grid-template-columns:minmax(0,1fr)]">
        <div className="grid min-w-0 content-center gap-[3.2cqmin]">
          <Entra>
            <h2 className="p-titulo">
              Gana el <span className="text-llama-viva">{pct}</span> de tus referidos
              {pct2 ? (
                <>
                  {' '}
                  y el <span className="text-senal">{pct2}</span> de los referidos de ellos
                </>
              ) : null}
              .
            </h2>
          </Entra>
          <Entra orden={1} className="min-w-0 overflow-x-auto">
            <table className="p-tabla">
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Precio</th>
                  <th scope="col">1.ª línea · {pct}</th>
                  {pct2 ? <th scope="col">2.ª línea · {pct2}</th> : null}
                </tr>
              </thead>
              <tbody>
                {publicos.map((plan) => (
                  <tr key={plan.codigo}>
                    <th scope="row">{plan.nombre}</th>
                    <td>{formatearUsd(plan.precioUsdCentavos)}</td>
                    <td className="text-llama-viva">
                      {formatearUsd(aplicarPorcentaje(plan.precioUsdCentavos, porcentajeBp))}
                    </td>
                    {pct2 ? (
                      <td className="text-senal">
                        {formatearUsd(aplicarPorcentaje(plan.precioUsdCentavos, segundaLineaBp))}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </Entra>
          <Entra orden={2}>
            <p className="p-pequeno text-niebla">
              Con tu licencia activa tienes tu enlace. Ganas en cada compra y renovación mientras
              sigan siendo clientes, y te enviamos lo ganado en USDT cada quincena.{' '}
              <span className="text-ceniza">No es un ingreso garantizado ni un empleo.</span>
            </p>
          </Entra>
        </div>
        <Entra orden={1} className="h-[60cqmin] min-w-0">
          <Red pct={pct} pct2={pct2} />
        </Entra>
      </div>
    </Marco>
  );
}
