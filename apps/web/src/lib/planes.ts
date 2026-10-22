import type { PlanPublico } from './publico';

/**
 * Los planes que se venden (públicos y de meses), con el ahorro de cada uno frente a pagar mes a mes el plan de un
 * mes y el plan recomendado: el que más ahorra (hoy, el semestral). Lo usan la landing y la presentación.
 */
export function planesEnVenta(planes: PlanPublico[]) {
  const publicos = planes.filter((p) => p.publico && p.meses !== null);
  const mensual = publicos.find((p) => p.meses === 1 && p.mesesObsequio === 0);
  const ahorroDe = (plan: PlanPublico) =>
    mensual && plan !== mensual
      ? mensual.precioUsdCentavos * ((plan.meses ?? 0) + plan.mesesObsequio) -
        plan.precioUsdCentavos
      : 0;
  const recomendado = publicos.reduce<PlanPublico | null>(
    (mejor, plan) => (ahorroDe(plan) > (mejor ? ahorroDe(mejor) : 0) ? plan : mejor),
    null,
  );
  return { publicos, ahorroDe, recomendado };
}
