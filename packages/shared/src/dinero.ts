import { DECIMALES, type Moneda } from './dominio.js';

const conDecimales = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const sinDecimales = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/**
 * Muestra un monto en dólares con formato colombiano: `USD 3.802` o `USD 380,20`.
 * Los montos en USD siempre se manejan en centavos enteros.
 */
export function formatearUsd(centavos: number): string {
  assertEntero(centavos, 'centavos');
  const formato = centavos % 100 === 0 ? sinDecimales : conDecimales;
  return `USD ${formato.format(centavos / 100)}`;
}

/** Aplica un porcentaje en puntos básicos (10 % = 1000) y redondea al centavo. */
export function aplicarPorcentaje(centavos: number, puntosBasicos: number): number {
  assertEntero(centavos, 'centavos');
  assertEntero(puntosBasicos, 'puntosBasicos');
  return Math.round((centavos * puntosBasicos) / 10_000);
}

/** Convierte un monto escrito con punto decimal ("319.5") a unidades base enteras de la moneda. */
export function aUnidadesBase(monto: string, moneda: Moneda): bigint {
  const decimales = DECIMALES[moneda];
  const coincide = /^(\d+)(?:\.(\d+))?$/.exec(monto.trim());
  if (!coincide) throw new Error(`Monto no válido: "${monto}"`);
  const [, entero = '0', fraccion = ''] = coincide;
  if (fraccion.length > decimales) {
    throw new Error(`${moneda} admite máximo ${decimales} decimales: "${monto}"`);
  }
  return BigInt(entero + fraccion.padEnd(decimales, '0'));
}

/** Convierte unidades base a texto con punto decimal, sin ceros sobrantes ("319", "0.00398"). */
export function deUnidadesBase(unidades: bigint, moneda: Moneda): string {
  if (unidades < 0n) throw new Error('El monto no puede ser negativo');
  const decimales = DECIMALES[moneda];
  const texto = unidades.toString().padStart(decimales + 1, '0');
  const entero = texto.slice(0, -decimales);
  const fraccion = quitarCerosFinales(texto.slice(-decimales));
  return fraccion ? `${entero}.${fraccion}` : entero;
}

/** Quita los ceros del final sin expresión regular (CodeQL marca `/0+$/` como lenta con entradas largas). */
function quitarCerosFinales(texto: string): string {
  let fin = texto.length;
  while (fin > 0 && texto[fin - 1] === '0') fin--;
  return texto.slice(0, fin);
}

function assertEntero(valor: number, nombre: string): void {
  if (!Number.isSafeInteger(valor)) throw new Error(`${nombre} debe ser un entero: ${valor}`);
}
