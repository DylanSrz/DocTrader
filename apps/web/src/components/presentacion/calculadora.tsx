'use client';

import {
  formatearUsd,
  LIMITES_PROYECCION,
  type Proyeccion,
  proyectarInteresCompuesto,
} from '@doctrader/shared';
import { useId, useState } from 'react';

/** "1.000", "1000 USD" → 100000 centavos. Solo dólares enteros. */
function centavos(texto: string): number {
  const digitos = texto.replace(/\D/g, '').slice(0, 9);
  return digitos ? Number(digitos) * 100 : 0;
}

/** "2,5" o "2.5 %" → 250 puntos básicos; `null` si está vacío o fuera de rango. */
function puntosBasicos(texto: string): number | null {
  const limpio = texto.replace(/[\s%]/g, '').replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(limpio)) return null;
  const bp = Math.round(Number(limpio) * 100);
  return bp <= LIMITES_PROYECCION.tasaMensualBp ? bp : null;
}

/** En dólares enteros: en una proyección los centavos solo estorban. */
const usd = (c: number) => formatearUsd(Math.round(c / 100) * 100);

function Barras({ proyeccion }: { proyeccion: Proyeccion }) {
  const puntos = proyeccion.puntos.slice(1);
  const maximo = Math.max(...puntos.map((p) => p.totalUsdCents), 1);
  const ancho = 300 / puntos.length;
  const alto = (c: number) => (c / maximo) * 130;
  return (
    <svg
      viewBox="0 0 300 150"
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label={`Por año: lo aportado y lo ganado. Al año ${puntos.length}, ${usd(proyeccion.totalUsdCents)} en total.`}
    >
      {puntos.map((p, i) => {
        const x = i * ancho + ancho * 0.15;
        const w = ancho * 0.7;
        const total = alto(p.totalUsdCents);
        const aportado = alto(Math.min(p.aportadoUsdCents, p.totalUsdCents));
        return (
          <g key={p.anio}>
            <rect
              x={x}
              y={140 - total}
              width={w}
              height={total - aportado}
              fill="var(--color-llama)"
            />
            <rect
              x={x}
              y={140 - aportado}
              width={w}
              height={aportado}
              fill="rgb(255 255 255 / 0.22)"
            />
          </g>
        );
      })}
      <line x1="0" x2="300" y1="140.5" y2="140.5" stroke="rgb(255 255 255 / 0.25)" />
    </svg>
  );
}

/**
 * Calculadora de interés compuesto de la presentación. La rentabilidad la escribe quien presenta (nunca hay una por
 * defecto): es un ejemplo ilustrativo, no una promesa ni una proyección de resultados del sistema.
 */
export function Calculadora() {
  const id = useId();
  const [capital, setCapital] = useState('1000');
  const [aporte, setAporte] = useState('100');
  const [tasa, setTasa] = useState('');
  const [anios, setAnios] = useState('10');
  const [reinvertir, setReinvertir] = useState(true);

  const tasaBp = puntosBasicos(tasa);
  const plazo = Math.min(Math.max(Number.parseInt(anios, 10) || 1, 1), LIMITES_PROYECCION.anios);
  const proyeccion =
    tasaBp === null
      ? null
      : proyectarInteresCompuesto({
          capitalUsdCents: centavos(capital),
          aporteMensualUsdCents: centavos(aporte),
          tasaMensualBp: tasaBp,
          anios: plazo,
          reinvertir,
        });

  const campos = [
    { clave: 'capital', etiqueta: 'Capital inicial (USD)', valor: capital, cambiar: setCapital },
    { clave: 'aporte', etiqueta: 'Aporte cada mes (USD)', valor: aporte, cambiar: setAporte },
    { clave: 'tasa', etiqueta: 'Rentabilidad mensual (%)', valor: tasa, cambiar: setTasa },
    { clave: 'anios', etiqueta: 'Plazo (años)', valor: anios, cambiar: setAnios },
  ];

  return (
    <div className="grid min-h-0 items-stretch gap-[5cqmin] [grid-template-columns:minmax(0,0.9fr)_minmax(0,1.3fr)] @max-[700px]:[grid-template-columns:minmax(0,1fr)]">
      <form className="grid content-center gap-[2.2cqmin]" onSubmit={(e) => e.preventDefault()}>
        {campos.map((c) => (
          <label key={c.clave} htmlFor={`${id}-${c.clave}`} className="grid gap-[0.8cqmin]">
            <span className="p-pequeno text-niebla">{c.etiqueta}</span>
            <input
              id={`${id}-${c.clave}`}
              className="p-campo"
              inputMode={c.clave === 'tasa' ? 'decimal' : 'numeric'}
              autoComplete="off"
              placeholder={c.clave === 'tasa' ? 'Escríbela' : undefined}
              value={c.valor}
              onChange={(e) => c.cambiar(e.target.value)}
              aria-invalid={c.clave === 'tasa' && tasa !== '' && tasaBp === null ? true : undefined}
            />
          </label>
        ))}
        <label className="flex items-center gap-[1.4cqmin] p-pequeno">
          <input
            type="checkbox"
            className="p-casilla"
            checked={reinvertir}
            onChange={(e) => setReinvertir(e.target.checked)}
          />
          Reinvertir las ganancias
        </label>
      </form>

      <div className="grid min-h-0 content-center gap-[2.4cqmin]" aria-live="polite">
        {proyeccion ? (
          <>
            <div className="grid gap-[0.6cqmin]">
              <p className="p-pequeno text-ceniza">
                En {plazo} {plazo === 1 ? 'año' : 'años'}, con los datos que escribiste
              </p>
              <p className="p-cifra-media">{usd(proyeccion.totalUsdCents)}</p>
            </div>
            <dl className="flex flex-wrap gap-x-[5cqmin] gap-y-[1cqmin] p-pequeno">
              <div>
                <dt className="text-ceniza">Aportado</dt>
                <dd className="cifra text-blanco">{usd(proyeccion.aportadoUsdCents)}</dd>
              </div>
              <div>
                <dt className="text-ceniza">{reinvertir ? 'Interés compuesto' : 'Ganancias'}</dt>
                <dd className="cifra text-llama-viva">{usd(proyeccion.gananciaUsdCents)}</dd>
              </div>
            </dl>
            <div className="h-[24cqmin] min-w-0">
              <Barras proyeccion={proyeccion} />
            </div>
          </>
        ) : (
          <p className="p-texto text-niebla">
            <span className="solo-pantalla">
              {tasa === ''
                ? 'Escribe una rentabilidad mensual para ver el ejemplo.'
                : 'Escribe la rentabilidad como un número entre 0 y 30, por ejemplo 2,5.'}
            </span>
            <span className="solo-impresion">
              La calculadora funciona en vivo en doctraderpro.com/presentacion.
            </span>
          </p>
        )}
        <p className="p-pequeno text-ceniza">
          Ejemplo ilustrativo con los datos que escribiste. No es una promesa ni una proyección de
          resultados del sistema: el trading tiene riesgo alto y puedes perder tu capital.
        </p>
      </div>
    </div>
  );
}
