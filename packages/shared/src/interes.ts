/**
 * Calculadora de interés compuesto de la presentación de ventas (`/presentacion`). Es un ejemplo ilustrativo con
 * los datos que escribe quien presenta: la plataforma nunca propone una rentabilidad (se vende una licencia de
 * software, no rendimientos).
 */

export interface DatosProyeccion {
  capitalUsdCents: number;
  aporteMensualUsdCents: number;
  /** Rentabilidad mensual en puntos básicos (2 % = 200). */
  tasaMensualBp: number;
  anios: number;
  /** Si las ganancias se suman al capital y también generan (interés compuesto) o se retiran cada mes. */
  reinvertir: boolean;
}

export interface PuntoProyeccion {
  anio: number;
  aportadoUsdCents: number;
  totalUsdCents: number;
}

export interface Proyeccion {
  /** Un punto por año, desde el año 0 (el capital inicial). */
  puntos: PuntoProyeccion[];
  aportadoUsdCents: number;
  totalUsdCents: number;
  gananciaUsdCents: number;
}

export const LIMITES_PROYECCION = { anios: 40, tasaMensualBp: 3_000 } as const;

/**
 * Mes a mes: primero rinde lo que hay y al final del mes entra el aporte. Sin reinvertir, solo rinde lo aportado y
 * las ganancias se acumulan aparte.
 */
export function proyectarInteresCompuesto(datos: DatosProyeccion): Proyeccion {
  const { capitalUsdCents, aporteMensualUsdCents, tasaMensualBp, anios, reinvertir } = datos;
  for (const [nombre, valor] of Object.entries({
    capitalUsdCents,
    aporteMensualUsdCents,
    tasaMensualBp,
    anios,
  })) {
    if (!Number.isSafeInteger(valor) || valor < 0)
      throw new Error(`${nombre} debe ser un entero no negativo`);
  }
  if (anios < 1 || anios > LIMITES_PROYECCION.anios) throw new Error('El plazo va de 1 a 40 años');
  if (tasaMensualBp > LIMITES_PROYECCION.tasaMensualBp)
    throw new Error('La tasa mensual llega hasta 30 %');

  const tasa = tasaMensualBp / 10_000;
  let aportado = capitalUsdCents;
  let saldo = capitalUsdCents;
  let ganancias = 0;
  const puntos: PuntoProyeccion[] = [
    { anio: 0, aportadoUsdCents: aportado, totalUsdCents: aportado },
  ];
  for (let mes = 1; mes <= anios * 12; mes++) {
    if (reinvertir) saldo += saldo * tasa;
    else ganancias += aportado * tasa;
    aportado += aporteMensualUsdCents;
    saldo += aporteMensualUsdCents;
    if (mes % 12 === 0) {
      puntos.push({
        anio: mes / 12,
        aportadoUsdCents: aportado,
        totalUsdCents: Math.round(reinvertir ? saldo : aportado + ganancias),
      });
    }
  }
  const total = puntos.at(-1)!.totalUsdCents;
  return {
    puntos,
    aportadoUsdCents: aportado,
    totalUsdCents: total,
    gananciaUsdCents: total - aportado,
  };
}
