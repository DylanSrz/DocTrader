import { describe, expect, it } from 'vitest';
import { PLANES_INICIALES, dolaresPorMes, mesesTotales } from './planes.js';

const precio = (code: string) => PLANES_INICIALES.find((p) => p.code === code)!.priceUsdCents;

describe('planes iniciales', () => {
  it('tienen los precios acordados: mensual y semestral (sin trimestral ni prueba desde el 2026-10-15)', () => {
    expect(PLANES_INICIALES.map((p) => p.code)).toEqual(['MENSUAL', 'SEMESTRAL']);
    expect(precio('MENSUAL')).toBe(12_000);
    expect(precio('SEMESTRAL')).toBe(49_900);
  });

  it('la semestral dura 6 meses, sin mes de obsequio', () => {
    const semestral = PLANES_INICIALES.find((p) => p.code === 'SEMESTRAL')!;
    expect(semestral.durationMonths).toBe(6);
    expect(semestral.bonusMonths).toBe(0);
  });
});

describe('precio por mes', () => {
  const plan = (code: string) => PLANES_INICIALES.find((p) => p.code === code)!;

  it('el semestral dura 6 meses; un plan en días no se mide en meses', () => {
    expect(mesesTotales(plan('SEMESTRAL'))).toBe(6);
    expect(mesesTotales({ durationMonths: null, bonusMonths: 0 })).toBeNull();
  });

  it('cuenta el obsequio si un plan lo tiene', () => {
    expect(mesesTotales({ durationMonths: 6, bonusMonths: 1 })).toBe(7);
  });

  it('da los equivalentes de la landing: 120 y 83 dólares al mes', () => {
    expect(dolaresPorMes(plan('MENSUAL'))).toBe(120);
    expect(dolaresPorMes(plan('SEMESTRAL'))).toBe(83);
  });
});
