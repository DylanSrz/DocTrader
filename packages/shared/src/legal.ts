import { formatearUsd } from './dinero.js';

/**
 * El texto público de un borrador de `docs/legal/`: sin el título (la página lo pone aparte), sin la nota interna
 * del principio ("Borrador del…, conviene que lo revise un abogado") y sin lo que va después de la línea `---`
 * final (anexos internos, como el texto de la casilla del registro o la versión corta del aviso de riesgo).
 */
export function textoPublicoDeBorrador(markdown: string): string {
  const sinEncabezado = markdown
    .replace(/\r\n/g, '\n')
    .replace(/^# [^\n]*\n+/, '')
    .replace(/^(>[^\n]*\n)+\n*/, '');
  const corte = sinEncabezado.search(/\n---\n/);
  return (corte === -1 ? sinEncabezado : sinEncabezado.slice(0, corte)).trim();
}

/** Marcador de los textos legales que se reemplaza por la tabla de precios vigentes (la que edita el admin). */
export const MARCADOR_PRECIOS = '{{precios}}';

/**
 * Cambia `{{precios}}` por la tabla de los planes a la venta con sus precios actuales, y `{{precio:CODIGO}}` por el
 * precio de un plan ("USD 120"). Así los términos nunca muestran un precio distinto del de la página de precios y
 * del pago: la única fuente es la tabla de planes. Un plan que ya no existe deja el marcador tal cual.
 */
export function sustituirPrecios(
  markdown: string,
  planes: {
    codigo: string;
    nombre: string;
    meses: number | null;
    mesesObsequio: number;
    precioUsdCentavos: number;
    publico: boolean;
  }[],
): string {
  const duracion = (p: (typeof planes)[number]) => {
    const meses = p.meses ?? 0;
    const base = meses === 1 ? '1 mes' : `${meses} meses`;
    return p.mesesObsequio > 0
      ? `${meses + p.mesesObsequio} meses (${base} + ${p.mesesObsequio} de obsequio)`
      : base;
  };
  const tabla = [
    '| Plan | Duración | Precio |',
    '|---|---|---|',
    ...planes
      .filter((p) => p.publico)
      .map((p) => `| ${p.nombre} | ${duracion(p)} | ${formatearUsd(p.precioUsdCentavos)} |`),
  ].join('\n');
  return markdown
    .split(MARCADOR_PRECIOS)
    .join(tabla)
    .replace(/\{\{precio:([A-Z_]+)\}\}/g, (marcador, codigo: string) => {
      const plan = planes.find((p) => p.codigo === codigo);
      return plan ? formatearUsd(plan.precioUsdCentavos) : marcador;
    });
}
