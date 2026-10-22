import { describe, expect, it } from 'vitest';
import { proyectarInteresCompuesto } from './interes.js';

const base = {
  capitalUsdCents: 100_000,
  aporteMensualUsdCents: 10_000,
  tasaMensualBp: 200,
  anios: 1,
};

describe('proyectarInteresCompuesto', () => {
  it('reinvirtiendo: USD 1.000 + USD 100 al mes al 2 % mensual por un año', () => {
    const p = proyectarInteresCompuesto({ ...base, reinvertir: true });
    // 1000 × 1,02¹² + 100 × (1,02¹² − 1) / 0,02 = 2609,45
    expect(p.totalUsdCents).toBe(260_945);
    expect(p.aportadoUsdCents).toBe(220_000);
    expect(p.gananciaUsdCents).toBe(40_945);
    expect(p.puntos).toHaveLength(2);
  });

  it('sin reinvertir solo rinde lo aportado', () => {
    // 2 % de (1000 + 1100 + … + 2100) = 372
    expect(proyectarInteresCompuesto({ ...base, reinvertir: false }).totalUsdCents).toBe(257_200);
  });

  it('con tasa 0 el total es lo aportado y hay un punto por año', () => {
    const p = proyectarInteresCompuesto({ ...base, tasaMensualBp: 0, anios: 5, reinvertir: true });
    expect(p.totalUsdCents).toBe(100_000 + 60 * 10_000);
    expect(p.puntos.map((x) => x.anio)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('rechaza plazos y tasas fuera de rango', () => {
    expect(() => proyectarInteresCompuesto({ ...base, anios: 0, reinvertir: true })).toThrow();
    expect(() => proyectarInteresCompuesto({ ...base, anios: 41, reinvertir: true })).toThrow();
    expect(() =>
      proyectarInteresCompuesto({ ...base, tasaMensualBp: 3_001, reinvertir: true }),
    ).toThrow();
    expect(() =>
      proyectarInteresCompuesto({ ...base, capitalUsdCents: -1, reinvertir: true }),
    ).toThrow();
  });
});
