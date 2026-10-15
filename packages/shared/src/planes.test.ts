import { describe, expect, it } from 'vitest';
import {
  PLANES_INICIALES,
  diferenciaParaCompletar,
  dolaresPorMes,
  mesesTotales,
} from './planes.js';

const precio = (code: string) => PLANES_INICIALES.find((p) => p.code === code)!.priceUsdCents;

describe('planes iniciales', () => {
  it('tienen los precios acordados: mensual, semestral y la prueba (sin trimestral desde el 2026-10-15)', () => {
    expect(PLANES_INICIALES.map((p) => p.code)).toEqual(['MENSUAL', 'SEMESTRAL', 'PRUEBA']);
    expect(precio('MENSUAL')).toBe(12_000);
    expect(precio('SEMESTRAL')).toBe(49_900);
    expect(precio('PRUEBA')).toBe(5_000);
  });

  it('la semestral dura 6 meses, sin mes de obsequio', () => {
    const semestral = PLANES_INICIALES.find((p) => p.code === 'SEMESTRAL')!;
    expect(semestral.durationMonths).toBe(6);
    expect(semestral.bonusMonths).toBe(0);
  });

  it('la prueba no se compra directo', () => {
    expect(PLANES_INICIALES.find((p) => p.code === 'PRUEBA')!.isPublic).toBe(false);
  });
});

describe('diferenciaParaCompletar', () => {
  it('cobra USD 70 o 449 según el plan', () => {
    const prueba = precio('PRUEBA');
    expect(diferenciaParaCompletar(precio('MENSUAL'), prueba)).toBe(7_000);
    expect(diferenciaParaCompletar(precio('SEMESTRAL'), prueba)).toBe(44_900);
  });
});

describe('precio por mes', () => {
  const plan = (code: string) => PLANES_INICIALES.find((p) => p.code === code)!;

  it('el semestral dura 6 meses y la prueba no se mide en meses', () => {
    expect(mesesTotales(plan('SEMESTRAL'))).toBe(6);
    expect(mesesTotales(plan('PRUEBA'))).toBeNull();
  });

  it('cuenta el obsequio si un plan lo tiene', () => {
    expect(mesesTotales({ durationMonths: 6, bonusMonths: 1 })).toBe(7);
  });

  it('da los equivalentes de la landing: 120 y 83 dólares al mes', () => {
    expect(dolaresPorMes(plan('MENSUAL'))).toBe(120);
    expect(dolaresPorMes(plan('SEMESTRAL'))).toBe(83);
    expect(dolaresPorMes(plan('PRUEBA'))).toBeNull();
  });
});
